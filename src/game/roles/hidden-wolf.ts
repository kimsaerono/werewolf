import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry } from "./types"
import { hiddenWolfCanKnife } from "../logic"

/**
 * 隐狼：不与狼群见面（wolfPack=false），预言家验出金水。
 * 当除隐狼外的狼阵营全部出局后接刀，带刀时并入狼人刀人环节。
 */
export class HiddenWolfRole extends BaseRole {
  readonly def: RoleDef = {
    id: "隐狼",
    camp: "wolf",
    unique: true,
    emoji: "🐺🌫️",
    short: "隐狼",
    wolfPack: false,
    intentKeys: ["nightWolfKill"]
  }

  onNightResolve(state: GameState): Effect[] {
    const self = state.players.find((p) => p.role === "隐狼")
    if (!self || !self.alive) return []
    // 仅当隐狼带刀（除隐狼外无存活狼阵营）时，由其产出狼刀效果，
    // 否则刀人效果由狼群里的狼人角色产出，避免重复。
    if (!hiddenWolfCanKnife(state)) return []
    if (!state.nightWolfKill) return []
    return [{ type: "kill", target: state.nightWolfKill, source: "狼人刀人" }]
  }

  scoreRules(_state: GameState, _player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }
}
