import type { GameState } from "./logic"
import type { Camp } from "./roles/types"
import { getRoleInstance } from "./roles/builtin"
import { isEffectiveWolf, GOD_LIST, getBoardRoles } from "./logic"

export type WinCamp = Camp | "civil" | "draw" | null

const WIN_TEXT: Record<"wolf" | "god" | "civil" | "third" | "draw", string> = {
  wolf: "狼人胜利",
  god: "好人胜利",
  civil: "好人胜利",
  third: "第三方胜利",
  draw: "平局",
}

export function isThirdMember(state: GameState, p: { name: string; role: string }): boolean {
  // 只有人狼恋（WG）才形成第三方；GG/WW 的丘比特是神，不是第三方
  if (getChainType(state) !== "WG") return false
  const role = getRoleInstance(p.role)
  if (role && role.def.id === "丘比特") return true
  return state.lovers.includes(p.name)
}

export function getChainType(state: GameState): "WG" | "GG" | "WW" | "" {
  if (state.lovers.length !== 2) return ""
  const [a, b] = state.lovers
  const pa = state.players.find((p) => p.name === a)
  const pb = state.players.find((p) => p.name === b)
  // 与 logic.getChainType 保持一致：角色未分配时链型未定，返回空串而不是默认 GG
  if (!pa || !pb || !pa.role || !pb.role) return ""
  const wa = isEffectiveWolf(pa)
  const wb = isEffectiveWolf(pb)
  if (wa && wb) return "WW"
  if (!wa && !wb) return "GG"
  return "WG"
}

/** 存活阵营计数 */
export interface CampCounts {
  wolf: number
  god: number
  civil: number
  /** 第三方角色（丘比特等 camp==="third"）存活数：屠城判胜前必须清零；屠边不看它 */
  third: number
}

/**
 * 存活阵营计数（checkWin 与必然结束求解器共用，避免两处口径不一致）。
 * 口径：
 * - 神职桶：注册表 camp==="god"；白痴始终计入（翻牌只失去投票权）
 * - 平民桶：camp==="villager"
 * - 第三方桶：camp==="third"；人狼恋时丘比特+情侣（2/3人）统一计入第三方
 */
export function aliveCampCounts(state: GameState): CampCounts {
  let wolf = 0
  let god = 0
  let civil = 0
  let third = 0
  const wg = getChainType(state) === "WG"
  for (const p of state.players) {
    if (!p.alive) continue
    // 人狼恋第三方：丘比特 + 两情侣（可 2 人或 3 人）统一计入第三方；
    // 其中的狼恋人不算狼队队友，好人恋人也不计入神/民。
    if (wg && isThirdMember(state, p)) {
      third++
      continue
    }
    const role = getRoleInstance(p.role)
    // 黑化野孩子按狼计（isEffectiveWolf 先于 camp 桶判定）
    if (isEffectiveWolf(p)) {
      wolf++
      continue
    }
    // 白痴（含已翻牌）：始终是神职；翻牌只失去投票权
    // 非人狼恋的丘比特是神
    if (role?.def.id === "丘比特") {
      god++
      continue
    }
    if (GOD_LIST.includes(p.role)) god++
    else if (role?.def.camp === "villager") civil++
    else if (role?.def.camp === "third") third++
  }
  return { wolf, god, civil, third }
}

/**
 * 狼人此刻是否已达成胜利条件（屠边：神或民任一全灭；屠城：神与民全灭，且第三方丘比特不在场）。
 * 屠边是「按类别屠」，丘比特既不算神也不算民，他活着不挡屠边；
 * 屠城是「杀光好人」，活着的丘比特就是没杀完。
 */
/** 板子里实际存在的阵营：屠边只统计存在的阵营，避免“无平民板子 civil=0 开局即狼胜” */
export function boardSidePresence(state: GameState): { god: boolean; civil: boolean } {
  const roles = getBoardRoles(state)
  // 人狼恋（WG）的丘比特属第三方，不再算神职边；GG/WW/未连人时丘比特仍是神。
  // 否则「唯一神位是 WG 丘比特」的无神板子会在第三方被清后误判狼人屠神获胜。
  const wg = getChainType(state) === "WG"
  return {
    god: roles.some((r) => (r === "丘比特" ? !wg : GOD_LIST.includes(r))),
    civil: roles.some((r) => getRoleInstance(r)?.def.camp === "villager"),
  }
}

export function wolfWinNow(
  c: CampCounts,
  mode: "edge" | "city",
  sides: { god: boolean; civil: boolean } = { god: true, civil: true },
): boolean {
  if (c.wolf === 0) return false
  if (mode === "city") return c.god === 0 && c.civil === 0 && c.third === 0
  // 退化板子（如只有狼 + WG 丘比特）：WG 丘比特属第三方，清掉第三方后既无神边也无民边。
  // 此时不能因为没有可屠的边而永远不判胜，按「所有非狼单位清零」判狼胜。
  if (!sides.god && !sides.civil) return c.god === 0 && c.civil === 0 && c.third === 0
  const godWiped = sides.god && c.god === 0
  const civilWiped = sides.civil && c.civil === 0
  return godWiped || civilWiped
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

type ResultCamp = "wolf" | "god" | "civil" | "third" | "draw"
type WinResult = { camp: ResultCamp; reason: string; winningThird: "WG" | "bomber" | "" }

/** 纯计算当前局面胜负；不写 state。先达成者由 recordWin 锁定。 */
export function computeWin(state: GameState): WinResult | null {
  // 炸弹人爆炸后无人生还：即使炸弹人已死，也优先判第三方胜
  if (state.bombVictory) {
    return { camp: "third", reason: "炸弹人引爆后无人生还，炸弹引爆达成独赢", winningThird: "bomber" }
  }

  // 角色自身 winRule（丘比特人狼恋第三方/平局）
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
  judgments.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  if (judgments.length > 0) {
    const top = judgments[0]
    return { camp: top.camp as ResultCamp, reason: top.reason, winningThird: top.camp === "third" ? "WG" : "" }
  }

  const aliveAll = state.players.filter((p) => p.alive)
  const counts = aliveCampCounts(state)
  const chain = getChainType(state)
  const thirdAlive = state.players.some((p) => p.alive && isThirdMember(state, p))
  const thirdActive = chain === "WG" && thirdAlive
  const bomberAlive = aliveAll.some((p) => getRoleInstance(p.role)?.def.id === "炸弹人")

  // 只剩炸弹人：炸弹人第三方胜利（技能分照常，另加最终胜利分）
  if (aliveAll.length === 1 && bomberAlive) {
    return { camp: "third", reason: "场上只剩炸弹人，炸弹人第三方胜利", winningThird: "bomber" }
  }

  if (thirdActive) {
    // 人狼恋第三方：有第三方成员且场上无外人 → 第三方胜（不要求三人全活）
    if (aliveAll.length > 0 && aliveAll.every((p) => isThirdMember(state, p))) {
      return { camp: "third", reason: "场上只剩丘比特与人狼情侣，第三方存活到最后", winningThird: "WG" }
    }
    // 平局：狼全灭 + 剩余全是平民，且双方票数严格持平（警长票 1.5）
    if (counts.wolf === 0) {
      const aliveNonThird = aliveAll.filter((p) => !isThirdMember(state, p))
      const onlyCivil = aliveNonThird.every((p) => {
        const role = getRoleInstance(p.role)
        return role && role.def.camp === "villager"
      })
      const thirdAliveCount = aliveAll.filter((p) => isThirdMember(state, p)).length
      // 第三方票数多于平民 → 能逐日投出平民，最终第三方胜，不是平局；
      // 平民票数多于第三方 → 能投出第三方，也不是平局；只有票数完全相等才僵持。
      const sheriff = aliveAll.find((p) => p.name === state.jingHui)
      const thirdVotes = thirdAliveCount + (sheriff && isThirdMember(state, sheriff) ? 0.5 : 0)
      const nonThirdVotes = aliveNonThird.length + (sheriff && !isThirdMember(state, sheriff) ? 0.5 : 0)
      if (onlyCivil && nonThirdVotes === thirdVotes) {
        return { camp: "draw", reason: "第三方与平民票数持平僵持，无法继续放逐，平局", winningThird: "" }
      }
    }
    // 第三方存活期间，好/狼不判胜
    return null
  }

  if (counts.wolf > 0) {
    // 屠边：只统计板子里实际存在的阵营；屠城：神+民+第三方全灭
    const sides = boardSidePresence(state)
    if (wolfWinNow(counts, state.winMode, sides)) {
      const reason = state.winMode === "city"
        ? "屠城：狼人存活，神职、平民与第三方全灭"
        : sides.god && counts.god === 0
          ? "屠边：神职全灭"
          : "屠边：平民全灭"
      return { camp: "wolf", reason, winningThird: "" }
    }
    return null
  }

  // 狼全灭：若还有第三方（炸弹人）存活，好人尚未获胜
  if (bomberAlive) return null
  // 全员出局（没有锁定的先达成胜方）→ 平局
  if (aliveAll.length === 0) {
    return { camp: "draw", reason: "全员出局，平局", winningThird: "" }
  }
  const wc: ResultCamp = counts.god > 0 ? "god" : "civil"
  return { camp: wc, reason: "所有狼人已出局，好人胜利", winningThird: "" }
}

/** 首个达成胜负条件时锁定；后续死亡/开枪不能改判 */
export function recordWin(state: GameState): void {
  // 炸弹人爆炸/遗言期间挂起胜负：等遗言结束由 finishBombLastWords 恢复
  if (state.bombLastWordsPending) return
  if (!isGameStarted(state) || state.finished || state.winCamp || state.winPending) return
  const r = computeWin(state)
  if (!r) return
  // 只记录“先达成”，等 checkWin 消费后再写入 winCamp（保持 ended 只报一次）
  state.winPending = r
}

/**
 * 角色驱动的胜负判定。
 * 已锁定则直接返回锁定结果；否则计算并写入。
 */
export function checkWin(state: GameState): { ended: boolean; text: string; reason: string } {
  // 炸弹人爆炸/遗言期间挂起胜负：等遗言结束再判
  if (state.bombLastWordsPending) {
    return { ended: false, text: "", reason: "" }
  }
  if (!isGameStarted(state)) {
    return { ended: false, text: "", reason: "" }
  }
  if (state.finished) {
    return { ended: false, text: "", reason: "" }
  }
  if (state.winCamp) {
    // 已锁定：ended 只在首次判出时为 true，避免 UI 重复弹窗
    return { ended: false, text: "", reason: "" }
  }
  if (state.winPending) {
    const p = state.winPending
    state.winCamp = p.camp
    state.winReason = p.reason
    state.winningThird = p.winningThird
    state.winPending = null
    return { ended: true, text: WIN_TEXT[p.camp], reason: p.reason }
  }
  const r = computeWin(state)
  if (!r) {
    return { ended: false, text: "", reason: "" }
  }
  state.winCamp = r.camp
  state.winReason = r.reason
  state.winningThird = r.winningThird
  return { ended: true, text: WIN_TEXT[r.camp], reason: r.reason }
}