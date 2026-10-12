import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, DieEvent, ScoreEntry } from "./types"
import { pushNightLog } from "../logic"

/**
 * 狼王角色：被刀/放逐后可开枪带走一人（被毒不能开枪）。
 */
export class WolfKingRole extends BaseRole {
  readonly def: RoleDef = {
    id: "狼王",
    camp: "wolf",
    unique: true,
    emoji: "🔫🐺",
    short: "狼王",
    nightStep: { order: 12, key: "wolfking" },
    intentKeys: [],
  }

  /** 狼王死亡前：被毒时标记吞枪 */
  onBeforeDeath(state: GameState, evt: DieEvent): boolean {
    const p = state.players.find((x) => x.name === evt.name)
    if (!p) return false

    // 被毒不能开枪
    if (evt.reason === "poison") {
      p.mark.wolfKingIsPoisoned = true
    }

    return false
  }

  /** 狼王死亡后：设置开枪标记（被毒除外） */
  onAfterDeath(state: GameState, evt: DieEvent & { killed: string[] }): void {
    const p = state.players.find((x) => x.name === evt.name)
    if (!p) return

    // 被毒不能开枪
    if (evt.reason === "poison") {
      pushNightLog(state, `⚠️狼王${evt.name}被毒，本出局无法开枪`)
      return
    }

    // 被刀可开枪（夜晚语境，记入夜晚日志）
    if (evt.reason === "wolfKill") {
      state.wolfKingShotPending = true
      pushNightLog(state, `🔫狼王${evt.name}被刀，可开枪`)
      return
    }

    // 被放逐可开枪（白天语境，播报由 finishVote 负责）
    if (evt.reason === "vote") {
      state.wolfKingShotPending = true
    }
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.wolfKingShotGood) entries.push({ reason: "枪带好人", delta: 1 })
    if (m.wolfKingShotWolf) entries.push({ reason: "枪带狼人", delta: -1 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return !!player.mark.wolfKingShotGood
  }
}