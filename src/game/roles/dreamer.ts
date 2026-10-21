import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 摄梦人：每夜入梦一人，使其成为梦游者并免疫夜间伤害（狼刀/毒药/反伤）；
 * 连续两晚入梦同一目标 → 触发梦杀，目标天亮死亡（无视守卫/解药）。
 * 摄梦人夜间死亡时，当前梦游者随行殉情（不开枪）；白天被放逐不触发殉情。
 */
export class DreamerRole extends BaseRole {
  readonly def: RoleDef = {
    id: "摄梦人",
    camp: "god",
    unique: true,
    emoji: "💭",
    short: "摄梦",
    intentKeys: []
  }

  scoreRules(_state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    const wk = Number(m.dreamKillWolf || 0)
    const gd = Number(m.dreamKillGood || 0)
    if (wk > 0) entries.push({ reason: "连梦击杀狼", delta: 1 * wk })
    if (gd > 0) entries.push({ reason: "连梦击杀好人", delta: -1 * gd })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return Number(player.mark.dreamKillWolf || 0) > 0
  }
}
