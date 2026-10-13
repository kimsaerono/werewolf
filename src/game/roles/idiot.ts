import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { DieReason, RoleDef, DieEvent, ScoreEntry, RoleSolverState } from "./types"
import { pushGlobalLog, pushFlow } from "../logic"

/**
 * 白痴角色：被放逐时可翻牌免死一次，之后失去投票权。
 */
export class IdiotRole extends BaseRole {
  readonly def: RoleDef = {
    id: "白痴",
    camp: "god",
    unique: true,
    emoji: "🙊",
    short: "痴",
    // 名义神职，但狼王枪带人计分口径中不算"神牌"（见 RuleDef.countsAsGod）
    countsAsGod: false,
    nightStep: { order: 41, key: "idiotOpen" },
    intentKeys: [],
  }

  /** 白痴被放逐时翻牌免死（仅一次） */
  onBeforeDeath(state: GameState, evt: DieEvent): boolean {
    if (evt.reason !== "vote") return false
    const p = state.players.find((x) => x.name === evt.name)
    if (!p) return false
    if (p.mark.idiotFlipped) return false // 已翻牌过，不再免死

    // 翻牌免死
    p.mark.idiotFlipped = true
    pushGlobalLog(state, `🙊白痴${evt.name}被放逐，翻牌免死（失去投票权）`)
    pushFlow(state, "放逐", evt.name, "白痴翻牌")
    return true // 拦截死亡
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    if (!player.alive) return {}
    return {
      flipped: !!player.mark.idiotFlipped,
    }
  }
}