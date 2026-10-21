import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 血月使徒：普通带刀狼（与狼群见面）。白天被放逐时：
 * - 若是场上仅剩的狼 → 血月之力延迟出局（当晚仍可行动/自爆，天亮死亡）；
 * - 自爆 → 立即死亡 + 当夜神职技能全部失效（血月封印）+ 跳过投票。
 */
export class BloodMoonRole extends BaseRole {
  readonly def: RoleDef = {
    id: "血月使徒",
    camp: "wolf",
    unique: true,
    emoji: "🌕",
    short: "血月",
    intentKeys: [],
  }

  scoreRules(_state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const seal = Number(player.mark.bloodSealCount || 0)
    if (seal > 0) entries.push({ reason: "血月封印", delta: 0.5 * seal })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return Number(player.mark.bloodSealCount || 0) > 0
  }
}
