import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry } from "./types"

/**
 * 炸弹人（第三方独赢）：白天被投票放逐时引爆炸弹，炸死所有投他的玩家（不开枪）。
 * - 爆炸结算后场上存活人数 == 0（全票是其子集）→ 第三方胜；
 * - 最后只剩自己存活 → 第三方胜；
 * - 两种胜利都拿最终胜利分 +4，炸狼/炸好人技能分照常；炸死其他第三方阵营不计分。
 * 未被放逐/被狼刀不触发；首夜只需认人（无夜间技能）。
 */
export class BombermanRole extends BaseRole {
  readonly def: RoleDef = {
    id: "炸弹人",
    camp: "third",
    unique: true,
    emoji: "💣",
    short: "炸弹",
    intentKeys: []
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    const wk = Number(m.bombWolfCount || 0)
    const gd = Number(m.bombGoodCount || 0)
    if (wk > 0) entries.push({ reason: "炸弹炸狼", delta: 1 * wk })
    if (gd > 0) entries.push({ reason: "炸弹炸好人", delta: -1 * gd })
    if (state.winCamp === "third" && (state.winningThird === "bomber" || state.bombVictory)) {
      entries.push({ reason: state.bombVictory ? "爆炸独赢" : "存活到最后独赢", delta: 4 })
    }
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return Number(player.mark.bombWolfCount || 0) > 0
  }
}
