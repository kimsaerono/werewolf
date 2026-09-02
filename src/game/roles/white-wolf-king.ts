import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 白狼王角色：狼人，白天可自爆带走一人。
 */
export class WhiteWolfKingRole extends BaseRole {
  readonly def: RoleDef = {
    id: "白狼王",
    camp: "wolf",
    unique: true,
    emoji: "❄️🐺",
    short: "白狼",
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    if (m.wolfHanTiaoJinghui) entries.push({ reason: "悍跳拿警徽", delta: 0.5 })
    if (m.wolfSelfKillCheat) entries.push({ reason: "自刀骗解药", delta: 0.5 })
    return entries
  }
}