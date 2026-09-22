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

/**
 * 角色驱动的胜负判定。
 * 遍历所有角色的 winRule，收集判定结果，按优先级排序后返回最终胜负。
 */
export function checkWin(state: GameState): { ended: boolean; text: string; reason: string } {
  const allAssigned = state.players.length > 0 && state.players.every((p) => p.role)
  const started = allAssigned && (state.phase !== "idle" || state.round > 0)
  if (!started) {
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
    const aliveGod = state.players.filter(
      (p) => p.alive && GOD_LIST.includes(p.role) && !(getRoleInstance(p.role)?.def.id === "白痴" && p.mark.idiotFlipped),
    )
    const aliveCivil = state.players.filter((p) => {
      const role = getRoleInstance(p.role)
      return p.alive && role && role.def.camp === "villager"
    })

    const chain = getChainType(state)
    const thirdAlive = state.players.some((p) => p.alive && isThirdMember(state, p))
    const thirdActive = chain === "WG" && thirdAlive

    if (thirdActive) {
      // ① 第三方胜：存活玩家全部是第三方成员（丘比特/恋人）
      const aliveAll = state.players.filter((p) => p.alive)
      if (aliveAll.length > 0 && aliveAll.every((p) => isThirdMember(state, p))) {
        wc = "third"
        reason = "场上只剩丘比特与人狼情侣，第三方存活到最后"
      }
      // ② 平局：狼全灭 + 剩余全是平民，且平民投票无法放逐第三方（票数不足/平票 → 僵局）
      else if (aliveWolf.length === 0) {
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
    } else if (aliveWolf.length > 0) {
      // 屠边：神或民任一全灭；屠城：神与民全灭
      const goodGone = state.winMode === "city"
        ? aliveGod.length === 0 && aliveCivil.length === 0
        : aliveGod.length === 0 || aliveCivil.length === 0
      if (goodGone) {
        wc = "wolf"
        reason = state.winMode === "city"
          ? "屠城：狼人存活，神职与平民全灭"
          : aliveGod.length === 0
            ? "屠边：神职全灭"
            : "屠边：平民全灭"
      }
    } else {
      wc = aliveGod.length > 0 ? "god" : "civil"
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