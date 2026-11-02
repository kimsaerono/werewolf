import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 野孩子：首夜睁眼选定榜样（榜样不知情）。榜样死亡后，下一夜起黑化为狼（普通狼）。
 * - 加入狼群：与狼同睁眼、互相认识、共享狼刀；
 * - 其他原狼全灭后仍保留狼刀，可单独刀人；可正常自爆；
 * - 按狼阵营计分与判胜，但不计入「狼群全员存活」加成。
 * 与榜样同日出局或自己先死 → 永不变身。
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
