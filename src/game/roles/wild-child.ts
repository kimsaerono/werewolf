import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 野孩子：首夜睁眼选定榜样（榜样不知情）。榜样死亡后（夜死次夜变身 / 昼死当夜变身）黑化为狼。
 * 与榜样同日出局或自己先死 → 永不变身。变身后按狼阵营计分与判胜。
 */
export class WildChildRole extends BaseRole {
  readonly def: RoleDef = {
    id: "野孩子",
    camp: "villager",
    unique: true,
    emoji: "🌱",
    short: "野孩",
    intentKeys: []
  }

  scoreRules(_state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    if (player.mark.isTransform) return [{ reason: "黑化变身", delta: 1 }]
    return []
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return !!player.mark.isTransform
  }
}
