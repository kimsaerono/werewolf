import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry } from "./types"

/**
 * 狼人角色：每晚可刀人。
 */
export class WerewolfRole extends BaseRole {
  readonly def: RoleDef = {
    id: "狼人",
    camp: "wolf",
    unique: false,
    emoji: "🐺",
    short: "狼",
    nightStep: { order: 10, key: "wolf" },
    intentKeys: ["nightWolfKill"],
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []
    if (state.nightWolfKill) {
      effects.push({
        type: "kill",
        target: state.nightWolfKill,
        source: "狼人刀人",
      })
    }
    return effects
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.wolfHanTiaoJinghui) entries.push({ reason: "悍跳拿警徽", delta: 0.5 })
    if (m.wolfSelfKillCheat) entries.push({ reason: "自刀骗解药", delta: 0.5 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    const m = player.mark
    return !!(m.wolfHanTiaoJinghui || m.wolfSelfKillCheat)
  }
}