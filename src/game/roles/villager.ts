import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

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
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }
}