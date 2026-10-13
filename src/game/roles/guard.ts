import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry, RoleSolverState } from "./types"
import { getRoleInstance } from "./builtin"

/**
 * 守卫角色：每晚可守护一人（不能连续两晚守护同一人）。
 */
export class GuardRole extends BaseRole {
  readonly def: RoleDef = {
    id: "守卫",
    camp: "god",
    unique: true,
    emoji: "🛡️",
    short: "守",
    nightStep: { order: 20, key: "guard" },
    intentKeys: ["nightGuardTarget"],
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []
    if (state.nightGuardTarget) {
      effects.push({
        type: "block",
        target: state.nightGuardTarget,
        source: "守卫守护",
      })
    }
    return effects
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.guardHitCount) entries.push({ reason: "守中", delta: (m.guardHitCount as number) * 0.5 })
    if (m.guardSameSaveKill) entries.push({ reason: "同守同救", delta: -0.5 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return ((player.mark.guardHitCount as number) || 0) > 0
  }

  /** 被白狼王自爆带走：守卫视为关键神职，白狼王 +0.5 */
  selfBombScore(_state: GameState): ScoreEntry | null {
    return { reason: "自爆带守卫", delta: 0.5 }
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    if (!player.alive) return {}
    // 计算 guardLast（上晚守的是哪一类）
    let last: string | null = null
    if (state.guardLastTarget) {
      const lastP = state.players.find((p) => p.name === state.guardLastTarget)
      if (lastP) {
        const role = getRoleInstance(lastP.role)
        if (lastP.role === "白痴" && lastP.mark.idiotFlipped) last = "flipped"
        else if (role?.def.camp === "villager") last = "c"
        else last = role?.def.id ?? null
      }
    }
    return { last }
  }
}