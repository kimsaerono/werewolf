import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry, Effect, RoleSolverState } from "./types"

/**
 * 白狼王角色：狼人，白天可自爆带走一人。
 * 同时作为狼人参与夜间刀人。
 */
export class WhiteWolfKingRole extends BaseRole {
  readonly def: RoleDef = {
    id: "白狼王",
    camp: "wolf",
    unique: true,
    emoji: "❄️🐺",
    short: "白狼",
    nightStep: { order: 11, key: "whitewolfking" },
    intentKeys: ["nightWolfKill"],
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []
    if (state.nightWolfKill) {
      effects.push({
        type: "kill",
        target: state.nightWolfKill,
        source: "狼人刀人",
      })
    }
    return effects
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.wolfHanTiaoJinghui) entries.push({ reason: "悍跳拿警徽", delta: 0.5 })
    if (m.wolfSelfKillCheat) entries.push({ reason: "自刀骗解药", delta: 0.5 })
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    const m = player.mark
    return !!(m.wolfHanTiaoJinghui || m.wolfSelfKillCheat)
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    // 白狼王无特殊状态，仅计数
    return {}
  }
}