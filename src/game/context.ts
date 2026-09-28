import type { GameState, Player } from "./logic"
import { killPlayer, pushGlobalLog, pushNightLog, pushFlow } from "./logic"
import type { DieReason, DieEvent, Effect, ScoreEntry } from "./roles/types"

/**
 * GameContext：角色与系统的唯一交互上下文。
 *
 * 设计原则：
 * 1. 只封装状态修改 API，不改动现有 GameState 数据结构
 * 2. 现有函数（killPlayer/pushGlobalLog 等）继续工作，本类是对它们的包装
 * 3. 新增事件系统，但先与现有逻辑并行存在，不替换
 * 4. 所有修改都通过本类方法，便于后续做状态隔离、日志、回放
 */

export type GameEvent =
  | { type: "beforeDeath"; payload: DieEvent }
  | { type: "afterDeath"; payload: DieEvent & { killed: string[] } }
  | { type: "nightResolve"; payload: { effects: Effect[] } }
  | { type: "sheriffDie"; payload: DieEvent }
  | { type: "badgeTransfer"; payload: { from: string; to: string } }
  | { type: "badgeLost"; payload: { holder: string; reason: string } }
  | { type: "phaseChange"; payload: { from: string; to: string } }
  | { type: "scoreCalc"; payload: { player: string; entries: ScoreEntry[] } }

type EventHandler = (ctx: GameContext, event: GameEvent) => void

export class GameContext {
  readonly state: GameState
  private handlers: Map<GameEvent["type"], EventHandler[]> = new Map()

  constructor(state: GameState) {
    this.state = state
  }

  // ===================== 事件系统 =====================

  on(type: GameEvent["type"], handler: EventHandler): () => void {
    const list = this.handlers.get(type) || []
    list.push(handler)
    this.handlers.set(type, list)
    return () => {
      const idx = list.indexOf(handler)
      if (idx >= 0) list.splice(idx, 1)
    }
  }

  emit(event: GameEvent): void {
    const list = this.handlers.get(event.type) || []
    for (const h of list) {
      try {
        h(this, event)
      } catch (e) {
        console.error(`[GameContext] event handler error for ${event.type}:`, e)
      }
    }
  }

  // ===================== 只读访问（供角色查询）=====================

  get players(): readonly Player[] {
    return this.state.players
  }

  get round(): number {
    return this.state.round
  }

  get phase(): string {
    return this.state.phase
  }

  get jingHui(): string {
    return this.state.jingHui
  }

  get lovers(): readonly string[] {
    return this.state.lovers
  }

  findPlayer(name: string): Player | undefined {
    return this.state.players.find((p) => p.name === name)
  }

  isAlive(name: string): boolean {
    const p = this.findPlayer(name)
    return p ? p.alive : false
  }

  // ===================== 状态修改 API（所有修改统一走这里）=====================

  /**
   * 玩家出局（统一入口）
   * 触发 beforeDeath → killPlayer → afterDeath 事件
   */
  killPlayer(name: string, reason: DieReason): string[] {
    const p = this.findPlayer(name)
    if (!p || !p.alive) return []

    // 触发 beforeDeath 事件（角色可拦截）
    const dieEvent: DieEvent = { name, reason }
    this.emit({ type: "beforeDeath", payload: dieEvent })

    // 调用现有 killPlayer（含殉情级联）
    const killed = killPlayer(this.state, name, reason)

    // 触发 afterDeath 事件
    this.emit({ type: "afterDeath", payload: { ...dieEvent, killed } })

    return killed
  }

  /** 设置警徽持有人 */
  setBadge(owner: string, isWolfHanTiao = false): void {
    const prev = this.state.jingHui
    this.state.jingHui = owner
    if (this.state.badgePending) this.state.badgePending = ""
    const ow = owner ? this.findPlayer(owner) : null
    const hanTiao = isWolfHanTiao || (!!ow && this.isWolfRole(ow.role))
    if (ow && hanTiao && this.isWolfRole(ow.role)) ow.mark.wolfHanTiaoJinghui = true
    pushGlobalLog(this.state, `📢警徽持有者：${owner || "无"}${hanTiao ? "（狼人悍跳拿到警徽）" : ""}`)
    pushFlow(this.state, "警徽", owner, hanTiao ? "悍跳" : "")
  }

  /** 警徽移交 */
  transferBadge(from: string, to: string): void {
    if (to === from || !to) {
      this.loseBadge(from, "出局")
      return
    }
    this.state.jingHui = to
    if (this.state.badgePending) this.state.badgePending = ""
    const ow = this.findPlayer(to)
    const hanTiao = !!ow && this.isWolfRole(ow.role)
    if (ow && hanTiao) ow.mark.wolfHanTiaoJinghui = true
    pushGlobalLog(this.state, `📢警长${from}已死亡，警徽移交：${to}`)
    pushFlow(this.state, "警徽移交", from, to)
    this.emit({ type: "badgeTransfer", payload: { from, to } })
  }

  /** 警徽流失 */
  loseBadge(holder: string, reason = "出局"): void {
    if (!holder) return
    if (this.state.jingHui === holder) this.state.jingHui = ""
    if (this.state.badgePending) this.state.badgePending = ""
    pushGlobalLog(this.state, `📢警长${holder}${reason}，警徽流失`)
    pushFlow(this.state, "警徽流失", holder)
    this.emit({ type: "badgeLost", payload: { holder, reason } })
  }

  /** 警长死亡处理（置 pending 标记，由 UI 决策） */
  handleSheriffDeath(): void {
    if (this.state.finished || !this.state.jingHui) return
    const holder = this.findPlayer(this.state.jingHui)
    if (holder && !holder.alive) {
      this.state.badgePending = holder.name
      this.emit({ type: "sheriffDie", payload: { name: holder.name, reason: holder.deathReason || "other" } })
    }
  }

  /** 清除 pending 标记 */
  resolveBadgePending(): void {
    this.state.badgePending = ""
  }

  // ===================== 夜晚操作 =====================

  setWolfKill(target: string): void {
    this.state.nightWolfKill = target
    this.state.nightSteps.wolf = true
  }

  setGuardTarget(target: string, sameSaveKill = false): void {
    this.state.nightGuardTarget = target
    this.state.nightSameSaveKill = sameSaveKill
    this.state.nightSteps.guard = true
  }

  setWitchSave(target: string): void {
    this.state.witchSaveUsed = true
    this.state.nightUsedDrug = "save"
    this.state.nightWitchSave = target
    this.state.nightSteps.witch = true
  }

  setWitchPoison(target: string): void {
    this.state.witchPoisonUsed = true
    this.state.nightUsedDrug = "poison"
    this.state.nightWitchPoison = target
    this.state.nightSteps.witch = true
  }

  setProphetReport(report: string): void {
    this.state.prophetReport = report
    this.state.nightSteps.prophet = true
  }

  // ===================== 阶段切换 =====================

  enterNight(): void {
    const prev = this.state.phase
    this.state.round += 1
    this.state.phase = "night"
    this.resetNightState()
    pushGlobalLog(this.state, `🌙第${this.state.round}晚，夜晚降临`)
    pushNightLog(this.state, `🌙第${this.state.round}晚开始`)
    this.emit({ type: "phaseChange", payload: { from: prev, to: "night" } })
  }

  enterDay(): void {
    const prev = this.state.phase
    this.state.phase = "day"
    this.state.uiDone = {}
    this.emit({ type: "phaseChange", payload: { from: prev, to: "day" } })
  }

  // ===================== 日志 =====================

  log(txt: string): void {
    pushGlobalLog(this.state, txt)
  }

  nightLog(txt: string): void {
    pushNightLog(this.state, txt)
  }

  flow(label: string, target = "", detail = ""): void {
    pushFlow(this.state, label, target, detail)
  }

  // ===================== 辅助方法 =====================

  isWolfRole(role: string): boolean {
    const { getRole } = require("./roles/registry")
    return getRole(role)?.camp === "wolf"
  }

  private resetNightState(): void {
    this.state.nightUsedDrug = null
    this.state.nightWolfKill = ""
    this.state.nightGuardTarget = ""
    this.state.nightWitchPoison = ""
    this.state.nightWitchSave = ""
    this.state.nightSameSaveKill = false
    this.state.nightSteps = { guard: false, wolf: false, prophet: false, witch: false }
    this.state.hunterShotPending = false
    this.state.wolfKingShotPending = false
    this.state.prophetReport = ""
    this.state.skipVote = false
    this.state.uiDone = {}
  }
}