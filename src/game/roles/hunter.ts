import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, DieEvent, ScoreEntry, RoleSolverState } from "./types"
import { pushNightLog, pushGlobalLog } from "../logic"

/**
 * 猎人角色：被刀/放逐后可开枪带走一人（被毒不能开枪）。
 */
export class HunterRole extends BaseRole {
  readonly def: RoleDef = {
    id: "猎人",
    camp: "god",
    unique: true,
    emoji: "🔫",
    short: "猎",
    intentKeys: [],
  }

  /** 猎人死亡前：被毒时标记吞枪 */
  onBeforeDeath(state: GameState, evt: DieEvent): boolean {
    const p = state.players.find((x) => x.name === evt.name)
    if (!p) return false

    // 被毒不能开枪
    if (evt.reason === "poison") {
      p.mark.hunterIsPoisoned = true
    }

    return false
  }

  /** 猎人死亡后：设置开枪标记（被毒除外） */
  onAfterDeath(state: GameState, evt: DieEvent & { killed: string[] }): void {
    const p = state.players.find((x) => x.name === evt.name)
    if (!p) return

    // 被毒不能开枪
    if (evt.reason === "poison") {
      pushNightLog(state, `⚠️猎人${evt.name}被毒，本出局无法开枪`)
      return
    }

    // 被刀可开枪（夜晚语境，记入夜晚日志）
    if (evt.reason === "wolfKill") {
      state.hunterShotPending = true
      pushNightLog(state, `🔫猎人${evt.name}被刀，可开枪`)
      return
    }

    // 被狼王枪带可开枪（非被毒）
    if (evt.reason === "shot") {
      state.hunterShotPending = true
      pushNightLog(state, `🔫猎人${evt.name}被狼王带走，可开枪`)
      pushGlobalLog(state, `🔫猎人${evt.name}被狼王带走，可开枪`)
      return
    }

    // 被放逐可开枪（白天语境，播报由 finishVote 负责）
    if (evt.reason === "vote") {
      state.hunterShotPending = true
    }
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.hunterKillWolf) entries.push({ reason: "带狼", delta: 1 })
    if (m.hunterKillGood) entries.push({ reason: "带好人", delta: -1 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return !!player.mark.hunterKillWolf
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    if (!player.alive) return {}
    return {
      canShoot: !player.mark.hunterIsPoisoned,
    }
  }
}