import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, ScoreEntry, RoleSolverState } from "./types"

/**
 * 丘比特角色：首夜可连两名玩家为情侣（可连自己）。
 * - 人狼恋（WG）：丘比特+情侣组成第三方；不要求三人全活，有成员且场上无外人即胜；
 * - 人人恋（GG）/狼狼恋（WW）：丘比特是神，没有第三方，按普通好/狼胜负；
 * - 玩家级阵营计数见 win-checker.aliveCampCounts。
 *
 * 胜负判定统一由 win-checker.computeWin 的第三方分支按 getChainType 动态处理：
 * 野孩子作为情侣黑化时，链型会在 GG→WG（第三方成立）或 WG→WW（第三方解散，
 * 丘比特变回神）之间切换，这里不再保留一份按原始角色判定的旧实现，避免两处口径漂移。
 */
export class CupidRole extends BaseRole {
  readonly def: RoleDef = {
    id: "丘比特",
    camp: "third",
    unique: true,
    emoji: "💘",
    short: "丘",
    intentKeys: ["lovers"],
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    // 丘比特无特殊状态，仅计数（情侣关系由 state.lovers 体现）
    return {}
  }
}
