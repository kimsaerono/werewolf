import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 猎魔人：每夜狩猎一人，天亮结算——目标是狼则其死，是好人则猎魔人反噬。
 * 免疫女巫毒药；首夜只认人不行动；被恐惧/封印则当夜无法狩猎。
 */
export class WolfHunterRole extends BaseRole {
  readonly def: RoleDef = {
    id: "猎魔人",
    camp: "god",
    unique: true,
    emoji: "🗡️",
    short: "猎魔",
    intentKeys: []
  }

  scoreRules(_state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    const wk = Number(m.huntWolfCount || 0)
    const gd = Number(m.huntGoodCount || 0)
    if (wk > 0) entries.push({ reason: "狩猎击杀狼", delta: 1 * wk })
    if (gd > 0) entries.push({ reason: "狩猎误伤好人", delta: -1 * gd })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return Number(player.mark.huntWolfCount || 0) > 0
  }
}
