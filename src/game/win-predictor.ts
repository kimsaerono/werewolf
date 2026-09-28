import type { GameState, Player, Mark } from "./logic"
import { isWolfRole, getBoardRoles } from "./logic"
import { getChainType, isThirdMember } from "./win-checker"
import { analyzeCertainty, solveForcedWin } from "./forced-win"
import type { Certainty } from "./forced-win"
import { getRoleInstance } from "./roles/builtin"

export interface WinPrediction {
  rates: {
    wolf: number
    good: number
    third: number
    draw: number
  }
  /** 三档确定度：A 真必然 / B 单方必胜 / C 均势 */
  certainty: Certainty
  /**
   * A 档（真必然）才非空。面板的「提前结束」按钮只认这一档 ——
   * B 档只是「某方占优、对手要靠犯错」，拿它结束对局会把 1% 的翻盘路掐死。
   */
  forcedWin: {
    detected: boolean
    winner: "wolf" | "good" | "third" | "draw"
    reason: string
    detail: string
    minNights: number
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

/** 未开始 / 无人存活时的中性结论：均势、无必胜方 */
const NEUTRAL: Certainty = { tier: "even", winner: null, underdog: null, reason: "", detail: "", facts: [], minNights: 0 }

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
    return {
      rates: { wolf: 50, good: 50, third: 0, draw: 0 },
      certainty: NEUTRAL,
      forcedWin: null,
      factors: ["🎮 游戏未开始"],
      hasThird: false,
    }
  }

  if (totalAlive === 0) {
    return {
      rates: { wolf: 0, good: 0, third: 0, draw: 0 },
      certainty: NEUTRAL,
      forcedWin: null,
      factors: [],
      hasThird: false,
    }
  }

  const aliveWolfCount = state.players.filter(p => p.alive && isWolfRole(p.role)).length
  const aliveGoodCount = state.players.filter(p => p.alive && !isWolfRole(p.role)).length
  const isThird = (p: { name: string; role: string }) => isThirdMember(state, p)
  const chain = getChainType(state)
  const thirdAlive = alivePlayers.filter(p => isThird(p))
  const hasThird = chain === "WG"
  const boardRoles = getBoardRoles(state) ?? []

  const factors: string[] = []

  // ===== 局势确定度（三档）=====
  // 第三方特判 + minimax 求解（守卫/女巫/猎人/骑士均按好人最优选择建模）。
  // A 真必然 / B 单方必胜 / C 均势，胜率显示与提前结束都读这里。
  const certainty = analyzeCertainty(state)
  const forcedWin: WinPrediction["forcedWin"] =
    certainty.tier === "forced" && certainty.winner
      ? {
          detected: true,
          winner: certainty.winner,
          reason: certainty.reason,
          detail: certainty.detail,
          minNights: certainty.minNights,
        }
      : null

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

  // A 档（真必然）根据 minNights 分层：
  // - minNights = 0：已是终局当步即结束，弱势方 0%，不给任何翻盘余地
  // - minNights >= 1：还得再熬几夜，弱势方留 1% 做最后缓冲（防“提前结束”误伤）
  if (certainty.tier === "forced" && certainty.winner) {
    const isInstant = certainty.minNights === 0
    const strong = isInstant ? 100 : 99
    const weak = isInstant ? 0 : 1
    switch (certainty.winner) {
      case "wolf":
        wolfRate = strong
        goodRate = weak
        thirdRate = 0
        drawRate = 0
        break
      case "good":
        goodRate = strong
        wolfRate = weak
        thirdRate = 0
        drawRate = 0
        break
      case "third":
        wolfRate = 0; goodRate = 0; thirdRate = 100; drawRate = 0; break
      case "draw":
        wolfRate = 0; goodRate = 0; thirdRate = 0; drawRate = 100; break
    }
  }

  // B 档文字只在与启发式数字同向时给出。
  // 两者有约 15% 的局面方向相反（启发式只数牌面存量，求解器还算行动权：
  // 1狼3预 这种牌面启发式看好人，但夜里能刀的是狼人），此时宁可不出声也不自相矛盾。
  if (certainty.tier === "oneSided" && certainty.winner) {
    const solverFavorsWolf = certainty.winner === "wolf"
    if (solverFavorsWolf === wolfRate > goodRate) factors.push(`⚖️ ${certainty.reason}`)
  }

  return {
    rates: {
      wolf: wolfRate,
      good: goodRate,
      third: thirdRate,
      draw: drawRate
    },
    certainty,
    forcedWin,
    factors: [...new Set(factors)],
    hasThird
  }
}

/**
 * 仅检测必然结局（用于独立调用）
 */
export function checkForcedWin(state: GameState) {
  return solveForcedWin(state)
}

/**
 * 仅取三档确定度（面板与复盘用）。返回的对象是缓存里的同一份引用，调用方不要改它。
 */
export function checkCertainty(state: GameState): Certainty {
  return analyzeCertainty(state)
}