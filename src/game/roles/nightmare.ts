import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 噩梦之影：每夜恐惧一人。
 * 恐狼 → 当晚狼队空刀；恐神职 → 目标当晚技能失效；恐自己/民 → 无效果。
 */
export class NightmareRole extends BaseRole {
  readonly def: RoleDef = {
    id: "噩梦之影",
    camp: "wolf",
    unique: true,
    emoji: "😱",
    short: "噩梦",
    intentKeys: []
  }

  scoreRules(_state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    const fearWolf = Number(m.fearWolfCount || 0)
    const fearGod = Number(m.fearGodCount || 0)
    if (fearWolf > 0) entries.push({ reason: "恐狼空刀", delta: -1 * fearWolf })
    if (fearGod > 0) entries.push({ reason: "恐神职", delta: 0.5 * fearGod })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return Number(player.mark.fearGodCount || 0) > 0
  }
}
