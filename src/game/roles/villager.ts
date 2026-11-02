import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry, RoleSolverState } from "./types"

/**
 * 平民角色：无特殊能力。
 */
export class VillagerRole extends BaseRole {
  readonly def: RoleDef = {
    id: "平民",
    camp: "villager",
    unique: false,
    emoji: "👤",
    short: "民",
    intentKeys: [],
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    // 平民无特殊状态，仅计数
    return {}
  }
}