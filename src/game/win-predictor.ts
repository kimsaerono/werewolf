import type { GameState, Player, Mark } from "./logic"
import { isWolfRole, getBoardRoles } from "./logic"
import { getChainType, isThirdMember } from "./win-checker"
import { getRoleInstance } from "./roles/builtin"

export interface WinPrediction {
  rates: {
    wolf: number
    good: number
    third: number
    draw: number
  }
  forcedWin: {
    detected: boolean
    winner: "wolf" | "good" | "third" | "draw"
    reason: string
    detail: string
  } | null
  factors: string[]
  /** 本局是否存在第三方阵营（丘比特圈出跨阵营人狼恋） */
  hasThird: boolean
}

/**
 * 胜率模型：基准分（板子配置）+ 实时增减（出局/技能消耗）。
 * 系数为可调常量，改动此处即可重新校准。
 * 开局一律 50/50（避免被误读为统计胜率），此后按局势增减。
 */
const BASE = {
  /** 中立起点（开局固定 50/50） */
  start: 50,
  /** 狼方强势角色价值（高于普通狼队，开局即体现） */
  wolfSkill: {
    狼王: 3,
    白狼王: 4,
  } as Record<string, number>,
  /** 出局/消耗增减（>0 表示对狼人有利） */
  delta: {
    wolfDie: 25, // 每死 1 狼
    prophetDie: 8, // 预言家出局
    witchDie: 7, // 女巫出局
    witchPoisonUsed: 3, // 女巫毒已用
    witchSaveUsed: 2, // 女巫解药已用
    hunterDieNoShot: 5, // 猎人带枪出局（未开枪）
    hunterShotDone: 2, // 猎人已开枪（枪已废）
    hunterPoisoned: 4, // 猎人被毒（枪废）
    guardDie: 4, // 守卫出局
    knightUsed: 2, // 骑士剑已用
    knightDie: 3, // 骑士出局
    idiotFlipped: 1, // 白痴翻牌（不能投票）
    idiotDie: 2, // 白痴出局
    wolfKingDie: 3, // 狼王出局（开场加成消失）
    whiteWolfDie: 4, // 白狼王出局
    edgeGodOneLeft: 15, // 神职仅剩 1 人 → 屠神在即
    edgeCivilOneLeft: 15, // 平民仅剩 1 人 → 屠民在即
  },
}

function markOf(p: Player): Mark {
  return p.mark
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * 核心胜率预测函数 - 每步操作后实时计算
 */
export function predictWinRate(state: GameState): WinPrediction {
  const alivePlayers = state.players.filter(p => p.alive)
  const totalAlive = alivePlayers.length

  // 游戏未开始（无玩家、或玩家未分配角色）：返回中立 50/50，无强制结局
  const gameNotStarted = state.players.length === 0 || !state.players.some(p => p.role)
  if (gameNotStarted) {
    return { rates: { wolf: 50, good: 50, third: 0, draw: 0 }, forcedWin: null, factors: ["🎮 游戏未开始"], hasThird: false }
  }

  if (totalAlive === 0) {
    return { rates: { wolf: 0, good: 0, third: 0, draw: 0 }, forcedWin: null, factors: [], hasThird: false }
  }

  const aliveWolfCount = state.players.filter(p => p.alive && isWolfRole(p.role)).length
  const aliveGoodCount = state.players.filter(p => p.alive && !isWolfRole(p.role)).length
  const isThird = (p: { name: string; role: string }) => isThirdMember(state, p)
  const chain = getChainType(state)
  const thirdAlive = alivePlayers.filter(p => isThird(p))
  const hasThird = chain === "WG"
  const boardRoles = getBoardRoles(state) ?? []

  const factors: string[] = []

  // ===== 必然结局检测（数学绝对必胜）=====
  let forcedWin: WinPrediction["forcedWin"] = null

  // 1. 狼全灭 -> 好人必胜
  if (aliveWolfCount === 0) {
    forcedWin = {
      detected: true,
      winner: "good",
      reason: "所有狼人已出局",
      detail: "场上已无存活狼人，好人阵营必胜"
    }
  }
  // 2. 无好人存活 -> 狼人必胜
  else if (aliveGoodCount === 0) {
    forcedWin = {
      detected: true,
      winner: "wolf",
      reason: "无好人存活",
      detail: "场上已无存活好人，狼人阵营必胜"
    }
  }
  // 3. 仅剩第三方成员 -> 第三方必胜
  else if (chain === "WG" && hasThird && alivePlayers.every(isThird)) {
    forcedWin = {
      detected: true,
      winner: "third",
      reason: "仅剩第三方成员",
      detail: "场上仅剩丘比特与人狼情侣，第三方阵营必胜"
    }
  }
  // 4. 第三方与平民票数僵持 -> 平局
  else if (chain === "WG" && aliveWolfCount === 0 && hasThird) {
    const aliveNonThird = alivePlayers.filter(p => !isThird(p))
    const onlyCivil = aliveNonThird.every(p => {
      const role = getRoleInstance(p.role)
      return role && role.def.camp === "villager"
    })
    if (onlyCivil && aliveNonThird.length <= thirdAlive.length) {
      forcedWin = {
        detected: true,
        winner: "draw",
        reason: "第三方与平民僵持",
        detail: "第三方人数不少于平民，票数与存活僵持，无法继续放逐"
      }
    }
  }
  // 5. 狼人数 >= 好人数 且 所有逆转技能完全失效 -> 狼人必胜
  else if (aliveWolfCount >= aliveGoodCount) {
    const hunter = alivePlayers.find(p => p.role === "猎人")
    const witch = alivePlayers.find(p => p.role === "女巫")
    const guard = alivePlayers.find(p => p.role === "守卫")
    const idiot = alivePlayers.find(p => p.role === "白痴" && !markOf(p).idiotFlipped)
    const knight = alivePlayers.find(p => p.role === "骑士" && !state.knightDuelUsed)

    const hunterThreat = !!hunter && !markOf(hunter).hunterIsPoisoned && !(markOf(hunter).hunterKillWolf || markOf(hunter).hunterKillGood)
    const witchThreat = !!witch && !(markOf(witch).witchPoWolf || markOf(witch).witchPoGood) && !markOf(witch).witchSaveGood
    const guardThreat = !!guard
    const idiotThreat = !!idiot
    const knightThreat = !!knight

    if (!hunterThreat && !witchThreat && !guardThreat && !idiotThreat && !knightThreat) {
      forcedWin = {
        detected: true,
        winner: "wolf",
        reason: "狼人数≥好人数且所有逆转技能失效",
        detail: `狼人${aliveWolfCount}人 ≥ 好人${aliveGoodCount}人，且猎人/女巫/守卫/白痴/骑士等逆转技能均已失效`
      }
    }
  }

  // ===== 胜率计算（基准分 + 实时增减）=====
  // ① 开场基准：开局固定 50/50（除非板子有强势狼角色）
  let wolf = BASE.start
  for (const role of boardRoles) {
    if (BASE.wolfSkill[role]) wolf += BASE.wolfSkill[role]
  }

  // ② 狼人出局增减
  const boardWolfCount = boardRoles.filter(r => isWolfRole(r)).length
  const deadWolfCount = boardWolfCount - aliveWolfCount
  wolf -= deadWolfCount * BASE.delta.wolfDie
  if (deadWolfCount > 0) factors.push(`🐺 已倒 ${deadWolfCount} 狼`)

  // ③ 神职/技能消耗增减
  const aliveRole = (r: string) => alivePlayers.find(p => p.role === r)

  const prophet = aliveRole("预言家")
  if (!prophet) {
    wolf += BASE.delta.prophetDie
    factors.push("🔮 预言家已出局")
  } else {
    factors.push("🔮 预言家在场")
  }

  const witch = aliveRole("女巫")
  if (witch) {
    if (state.witchPoisonUsed) {
      wolf += BASE.delta.witchPoisonUsed
      factors.push("☠️ 女巫毒已用")
    }
    if (state.witchSaveUsed) {
      wolf += BASE.delta.witchSaveUsed
      factors.push("💚 女巫解药已用")
    }
    if (!state.witchPoisonUsed && !state.witchSaveUsed) {
      factors.push("✅ 女巫双药齐在")
    }
  } else {
    wolf += BASE.delta.witchDie
    factors.push("🧙 女巫已出局")
  }

  const hunter = aliveRole("猎人")
  if (hunter) {
    if (markOf(hunter).hunterIsPoisoned) {
      wolf += BASE.delta.hunterPoisoned
      factors.push("🔫 猎人被毒·枪废")
    } else {
      factors.push("🔫 猎人带枪")
    }
  } else {
    const hunterState = state.players.find(p => p.role === "猎人")
    const shotDone = hunterState && (markOf(hunterState).hunterKillWolf || markOf(hunterState).hunterKillGood)
    wolf += shotDone ? BASE.delta.hunterShotDone : BASE.delta.hunterDieNoShot
    factors.push(shotDone ? "🔫 猎人已开枪殉职" : "🔫 猎人带枪出局")
  }

  const guard = aliveRole("守卫")
  if (guard) {
    factors.push("🛡️ 守卫在场")
  } else if (boardRoles.includes("守卫")) {
    wolf += BASE.delta.guardDie
    factors.push("🛡️ 守卫已出局")
  }

  const knight = aliveRole("骑士")
  if (knight) {
    if (state.knightDuelUsed) {
      wolf += BASE.delta.knightUsed
      factors.push("⚔️ 骑士剑已出")
    } else {
      factors.push("⚔️ 骑士未决斗")
    }
  } else if (boardRoles.includes("骑士")) {
    wolf += BASE.delta.knightDie
    factors.push("⚔️ 骑士已出局")
  }

  const idiot = aliveRole("白痴")
  if (idiot) {
    if (markOf(idiot).idiotFlipped) {
      wolf += BASE.delta.idiotFlipped
      factors.push("🙊 白痴已翻牌")
    } else {
      factors.push("🙊 白痴未翻")
    }
  } else if (boardRoles.includes("白痴")) {
    wolf += BASE.delta.idiotDie
    factors.push("🙊 白痴已出局")
  }

  // ④ 狼方技能角色出局（开场加成消失）
  if (boardRoles.includes("狼王") && !aliveRole("狼王")) {
    wolf -= BASE.delta.wolfKingDie
    factors.push("👑 狼王已出局")
  } else if (aliveRole("狼王")) {
    factors.push("👑 狼王在场")
  }
  if (boardRoles.includes("白狼王") && !aliveRole("白狼王")) {
    wolf -= BASE.delta.whiteWolfDie
    factors.push("💥 白狼王已出局")
  } else if (aliveRole("白狼王")) {
    factors.push("💥 白狼王在场")
  }

  // ⑤ 涂边临近提示
  const aliveGods = alivePlayers.filter(p => {
    const role = getRoleInstance(p.role)
    return role && role.def.camp === "god"
  }).length
  const aliveCivils = alivePlayers.filter(p => {
    const role = getRoleInstance(p.role)
    return role && role.def.camp === "villager"
  }).length
  if (aliveWolfCount > 0 && aliveGods === 1) {
    wolf += BASE.delta.edgeGodOneLeft
    factors.push("⚰️ 神职仅剩 1 · 屠神在即")
  }
  if (aliveWolfCount > 0 && aliveCivils === 1) {
    wolf += BASE.delta.edgeCivilOneLeft
    factors.push("⚰️ 平民仅剩 1 · 屠民在即")
  }

  // ⑥ 恋链影响（不构成第三方时也给轻微信息扰动）
  if (chain === "WW") {
    wolf += 3
    factors.push("💘 狼狼恋")
  } else if (chain === "GG") {
    wolf -= 2
    factors.push("💘 人人恋")
  }

  // ⑦ 结算：无第三方时仅在狼/好间分配；有第三方时挤出第三方份额
  let wolfRate = clamp(Math.round(wolf), 3, 97)
  let goodRate = 100 - wolfRate
  let thirdRate = 0
  let drawRate = 0

  if (hasThird) {
    // 第三方在不良前提下持续登场，分摊约 15~25%
    let thirdShare = thirdAlive.length * 8 + 8
    thirdShare = clamp(thirdShare, 10, 30)
    const rest = 100 - thirdShare
    wolfRate = clamp(Math.round(wolfRate * rest / 100), 1, rest - 1)
    goodRate = rest - wolfRate
    thirdRate = thirdShare
    factors.push("💘 人狼恋·第三方")
  }

  // 必胜情况直接覆盖胜率显示
  if (forcedWin) {
    switch (forcedWin.winner) {
      case "wolf":
        wolfRate = 100; goodRate = 0; thirdRate = 0; drawRate = 0; break
      case "good":
        wolfRate = 0; goodRate = 100; thirdRate = 0; drawRate = 0; break
      case "third":
        wolfRate = 0; goodRate = 0; thirdRate = 100; drawRate = 0; break
      case "draw":
        wolfRate = 0; goodRate = 0; thirdRate = 0; drawRate = 100; break
    }
  }

  return {
    rates: {
      wolf: wolfRate,
      good: goodRate,
      third: thirdRate,
      draw: drawRate
    },
    forcedWin,
    factors: [...new Set(factors)],
    hasThird
  }
}

/**
 * 仅检测必然结局（用于独立调用）
 */
export function checkForcedWin(state: GameState) {
  const result = predictWinRate(state)
  return result.forcedWin
}