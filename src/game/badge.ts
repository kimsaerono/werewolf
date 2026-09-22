import type { GameState } from "./logic"
import { pushGlobalLog, pushFlow, isWolfRole } from "./logic"

/**
 * 警徽统一服务：把散落在各流程的警徽逻辑收拢到此，避免语义分裂。
 * 规则同旧实现（守卫现状：移交弹窗由 UI 消费 loseBadge/transferBadge；自爆吞警徽由引擎直接调用）。
 */

/** 设置警徽持有人（含竞选与死亡后移交两种场景）。owner 为空则视作无警徽。 */
export function setJingHui(state: GameState, owner: string, isWolfHanTiao: boolean): void {
  const prev = state.jingHui
  state.jingHui = owner
  if (state.badgePending) state.badgePending = ""
  const ow = owner ? state.players.find((p) => p.name === owner) : null
  // 自动判定悍跳：持有者为狼人阵营即记为悍跳
  const hanTiao = isWolfHanTiao || (!!ow && isWolfRole(ow.role))
  if (ow && hanTiao && isWolfRole(ow.role)) ow.mark.wolfHanTiaoJinghui = true
  const prevP = prev ? state.players.find((p) => p.name === prev) : null
  if (prev && prev !== owner && prevP && !prevP.alive) {
    pushGlobalLog(state, `📢警长${prev}已死亡，警徽移交：${owner || "无警徽"}`)
  } else {
    pushGlobalLog(state, `📢警徽持有者：${owner || "无"}${hanTiao ? "（狼人悍跳拿到警徽）" : ""}`)
  }
  pushFlow(state, "警徽", owner, hanTiao ? "悍跳" : "")
}

/** 警长出局且未作决断时的通用流失处理（无自动移交逻辑，直接作废） */
export function autoTransferJingHui(state: GameState): string | null {
  if (!state.jingHui) return null
  const holder = state.players.find((p) => p.name === state.jingHui)
  if (!holder || holder.alive) return null
  loseBadge(state, state.jingHui)
  return null
}

/** 警长出局：警徽直接作废（流失）。兼容原 useGame 直接调用签名。 */
export function loseJingHui(state: GameState): void {
  if (!state.jingHui) return
  loseBadge(state, state.jingHui)
}

/** 警徽直接作废（流失）。prev 为原警长名（用于日志），verb 可定制死亡描述（默认"出局"）。 */
export function loseBadge(state: GameState, prev: string, verb = "出局"): void {
  if (!prev) return
  if (state.jingHui === prev) state.jingHui = ""
  if (state.badgePending) state.badgePending = ""
  pushGlobalLog(state, `📢警长${prev}${verb}，警徽流失`)
  pushFlow(state, "警徽流失", prev)
}

/** 死亡后警徽移交给新警长（from 为已出局的旧警长，to 为接手者）。 */
export function transferBadge(state: GameState, from: string, to: string): void {
  if (to === from || !to) {
    loseBadge(state, from)
    return
  }
  state.jingHui = to
  if (state.badgePending) state.badgePending = ""
  const ow = state.players.find((p) => p.name === to)
  const hanTiao = !!ow && isWolfRole(ow.role)
  if (ow && hanTiao) ow.mark.wolfHanTiaoJinghui = true
  pushGlobalLog(state, `📢警长${from}已死亡，警徽移交：${to}`)
  pushFlow(state, "警徽移交", from, to)
}

/**
 * 统一入口（UI 在每次死亡结算后消费）：若当前警长已出局且尚未处理，把待处理警长名写入 state.badgePending，
 * 交由 UI/流程弹窗决策移交或流失。已处理（jingHui 已清空或已改变）则不动。
 */
export function handleSheriffDeath(state: GameState): void {
  if (state.finished || !state.jingHui) return
  const holder = state.players.find((p) => p.name === state.jingHui)
  if (holder && !holder.alive) {
    state.badgePending = holder.name
  }
}

/** 消费完待处理警长弹窗后调用：清除 pending 标记。 */
export function resolveBadgePending(state: GameState): void {
  state.badgePending = ""
}
