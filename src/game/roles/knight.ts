import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 骑士角色：白天可决斗一人（每局一次），戳狼则狼死，戳好人则自己出局。
 */
export class KnightRole extends BaseRole {
  readonly def: RoleDef = {
    id: "骑士",
    camp: "god",
    unique: true,
    emoji: "⚔️",
    short: "骑",
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    // 骑士复用 hunterKillWolf / hunterKillGood 标记
    if (m.hunterKillWolf) entries.push({ reason: "决斗戳狼", delta: 1 })
    if (m.hunterKillGood) entries.push({ reason: "决斗戳错", delta: -1 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return !!player.mark.hunterKillWolf
  }
}