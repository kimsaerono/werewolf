import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, RoleSolverState } from "./types"

/**
 * 守墓人角色：好人阵营·神职。
 * - 首夜不触发；第二夜起，每晚得知「上一白天被投票放逐出局」的玩家属于好人阵营还是狼人阵营。
 * - 仅对白天公投出局（deathReason === "vote"）生效；被刀/毒/枪/殉情等出局不产生信息。
 * - 被动触发，无需选择目标；上一白天无人被放逐则当夜无信息。
 * - 死亡后技能失效（出局则夜间不再出现该步骤）。
 * - 无保护/击杀能力，胜负与好人一致；不加个人分（仅阵营胜负分）。
 */
export class GravekeeperRole extends BaseRole {
  readonly def: RoleDef = {
    id: "守墓人",
    camp: "god",
    unique: true,
    emoji: "🪦",
    short: "墓",
    intentKeys: [],
    nightStep: {
      order: 55,
      key: "gravekeeper",
      label: "守墓人验尸",
      emoji: "🪦",
      enabled: (c) => c.boardRoles.includes("守墓人") && !c.nightSteps.gravekeeper,
    },
  }

  extractState(
    player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> },
    state: GameState,
  ): RoleSolverState {
    if (!player.alive) return {}
    return { lastVoteOut: state.lastVoteOut || "" }
  }
}
