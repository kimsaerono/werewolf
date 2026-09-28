import type { GameState } from "./logic"
import type { Camp } from "./roles/types"
import { getRoleInstance } from "./roles/builtin"
import { isWolfRole, GOD_LIST } from "./logic"

export type WinCamp = Camp | "civil" | "draw" | null

const WIN_TEXT: Record<"wolf" | "god" | "civil" | "third" | "draw", string> = {
  wolf: "狼人胜利",
  god: "好人胜利",
  civil: "好人胜利",
  third: "第三方胜利",
  draw: "平局",
}

export function isThirdMember(state: GameState, p: { name: string; role: string }): boolean {
  const role = getRoleInstance(p.role)
  if (role && role.def.id === "丘比特") return true
  return state.lovers.includes(p.name)
}

export function getChainType(state: GameState): "WG" | "GG" | "WW" | "" {
  if (state.lovers.length !== 2) return ""
  const [a, b] = state.lovers
  const pa = state.players.find((p) => p.name === a)
  const pb = state.players.find((p) => p.name === b)
  if (!pa || !pb) return ""
  const wa = isWolfRole(pa.role)
  const wb = isWolfRole(pb.role)
  if (wa && wb) return "WW"
  if (!wa && !wb) return "GG"
  return "WG"
}

/** 存活阵营计数 */
export interface CampCounts {
  wolf: number
  god: number
  civil: number
}

/**
 * 存活阵营计数（checkWin 与必然结束求解器共用，避免两处口径不一致）。
 * 口径与改造前逐条等价，刻意保持不变：
 * - 神职桶：注册表 camp==="god"（不含已翻牌的白痴）
 * - 平民桶：camp==="villager"（已翻牌的白痴 camp 仍是 god，故两个桶都不进）
 * - camp==="third"（丘比特）不进任何桶，由第三方分支单独判定
 * 已知历史遗留：翻牌后的白痴既不算神也不算民。本函数刻意不修正它，
 * 以保证「必然结束检测」与「实际判胜」口径完全一致，且不改动原有对局结果。
 */
export function aliveCampCounts(state: GameState): CampCounts {
  let wolf = 0
  let god = 0
  let civil = 0
  for (const p of state.players) {
    if (!p.alive) continue
    if (isWolfRole(p.role)) {
      wolf++
      continue
    }
    if (GOD_LIST.includes(p.role) && !(getRoleInstance(p.role)?.def.id === "白痴" && p.mark.idiotFlipped)) god++
    else if (getRoleInstance(p.role)?.def.camp === "villager") civil++
  }
  return { wolf, god, civil }
}

/** 狼人此刻是否已达成胜利条件（屠边：神或民任一全灭；屠城：神与民全灭） */
export function wolfWinNow(c: CampCounts, mode: "edge" | "city"): boolean {
  if (c.wolf === 0) return false
  return mode === "city" ? c.god === 0 && c.civil === 0 : c.god === 0 || c.civil === 0
}

/** 好人此刻是否已达成胜利条件（狼人全灭；与 checkWin 的 else 分支一致） */
export function goodWinNow(c: CampCounts): boolean {
  return c.wolf === 0
}

/**
 * 对局是否已进入可判定状态：**全部角色已分配完毕，且对局已开始**（不再是准备阶段）。
 * checkWin 与「必然结束检测」共用同一前置条件，避免未开局就出检测结论。
 */
export function isGameStarted(state: GameState): boolean {
  const allAssigned = state.players.length > 0 && state.players.every((p) => p.role)
  return allAssigned && (state.phase !== "idle" || state.round > 0)
}

/**
 * 角色驱动的胜负判定。
 * 遍历所有角色的 winRule，收集判定结果，按优先级排序后返回最终胜负。
 */
export function checkWin(state: GameState): { ended: boolean; text: string; reason: string } {
  if (!isGameStarted(state)) {
    return { ended: false, text: "", reason: "" }
  }
  // 本局已结算：不再重判（提前结束写好的 winCamp 不能被后续 refresh 覆盖成 null）
  if (state.finished) {
    return { ended: false, text: "", reason: "" }
  }

  // 收集所有角色的胜负判定
  const judgments: Array<{ camp: WinCamp; reason: string; priority: number }> = []

  for (const player of state.players) {
    if (!player.alive) continue
    const role = getRoleInstance(player.role)
    if (role && role.winRule) {
      const result = role.winRule(state)
      if (result) {
        judgments.push({
          camp: result.camp as WinCamp,
          reason: result.reason,
          priority: role.def.winRule?.priority ?? 0,
        })
      }
    }
  }

  // 按优先级排序（数字小者优先）
  judgments.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  // 取最高优先级的判定结果
  let wc: WinCamp = null
  let reason = ""

  if (judgments.length > 0) {
    const top = judgments[0]
    wc = top.camp
    reason = top.reason
  } else {
    // 默认规则：屠边/屠城
    const aliveWolf = state.players.filter((p) => p.alive && isWolfRole(p.role))
    const aliveAll = state.players.filter((p) => p.alive)
    const counts = aliveCampCounts(state)
    const aliveWolfCount = counts.wolf
    const aliveGodCount = counts.god
    const aliveCivilCount = counts.civil

    const chain = getChainType(state)
    const thirdAlive = state.players.some((p) => p.alive && isThirdMember(state, p))
    const thirdActive = chain === "WG" && thirdAlive

    if (thirdActive) {
      // ① 第三方胜：存活玩家全部是第三方成员（丘比特/恋人）
      if (aliveAll.length > 0 && aliveAll.every((p) => isThirdMember(state, p))) {
        wc = "third"
        reason = "场上只剩丘比特与人狼情侣，第三方存活到最后"
      }
      // ② 平局：狼全灭 + 剩余全是平民，且平民投票无法放逐第三方（票数不足/平票 → 僵局）
      else if (aliveWolfCount === 0) {
        const aliveNonThird = aliveAll.filter((p) => !isThirdMember(state, p))
        const onlyCivil = aliveNonThird.every((p) => {
          const role = getRoleInstance(p.role)
          return role && role.def.camp === "villager"
        })
        const thirdAliveCount = aliveAll.filter((p) => isThirdMember(state, p)).length
        if (onlyCivil && aliveNonThird.length <= thirdAliveCount) {
          wc = "draw"
          reason = "第三方与平民票数持平僵持，无法继续放逐，平局"
        }
      }
      // 否则：情侣未死前，好/狼一律不判胜（第三方保留）
    } else if (aliveWolfCount > 0) {
      // 屠边：神或民任一全灭；屠城：神与民全灭
      if (wolfWinNow(counts, state.winMode)) {
        wc = "wolf"
        reason = state.winMode === "city"
          ? "屠城：狼人存活，神职与平民全灭"
          : aliveGodCount === 0
            ? "屠边：神职全灭"
            : "屠边：平民全灭"
      }
    } else {
      wc = aliveGodCount > 0 ? "god" : "civil"
      reason = "所有狼人已出局，好人胜利"
    }
  }

  const prev = state.winCamp
  state.winCamp = wc as import("./logic").WinCamp
  const ended = prev !== wc && wc !== null
  return {
    ended,
    text: ended ? WIN_TEXT[wc as "wolf" | "god" | "civil" | "third" | "draw"] : "",
    reason,
  }
}