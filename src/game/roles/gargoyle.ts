import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry, RoleSolverState } from "./types"
import { getRoleInstance } from "./builtin"

/**
 * 石像鬼角色：狼人阵营·特殊狼（狼群外）。
 * - 不与普通狼人见面：不参与狼人会议/刀人，普通狼不知道石像鬼是谁，石像鬼也不知道普通狼是谁。
 * - 每晚独立睁眼，查验一名存活玩家的完整具体身份（返回角色名，非仅阵营）。
 * - 不能自爆；可被狼刀、毒杀、放逐出局。
 * - 条件解锁：除石像鬼外狼阵营全灭后，获得夜间刀人能力（保留验人技能）。
 * - 预言家查验石像鬼 → 狼（camp === "wolf" 自动成立）。
 * - 胜负与狼人一致（camp === "wolf"，计入屠边/屠城）。
 * - 计分：存活到终局且狼队胜利 +0.5。
 *
 * 单一夜间步骤 "gargoyle"（order 25，狼人之前；首夜由 step-flow 后置到所有确认步骤之后）：
 * 验人 + （解锁后）刀人，均在面板内完成，由「闭眼」标记 uiDone 结束
 * （不使用 nightSteps，保证解锁刀人后仍可继续操作）。
 * 步骤元数据（order/enabled）声明在 builtin.ts 的注册表字面量里 —— 步骤编排只读注册表。
 */
export class GargoyleRole extends BaseRole {
  readonly def: RoleDef = {
    id: "石像鬼",
    camp: "wolf",
    unique: true,
    emoji: "🗿",
    short: "石",
    wolfPack: false,
    intentKeys: ["nightWolfKill"],
  }

  onNightResolve(state: GameState): Effect[] {
    const self = state.players.find((p) => getRoleInstance(p.role)?.def.id === "石像鬼")
    if (!self || !self.alive) return []
    // 仅在本夜确实由石像鬼完成刀人时产出效果（避免与普通狼刀重复产出）
    if (!self.mark.gargoyleKilledTonight) return []
    if (!state.nightWolfKill) return []
    return [{ type: "kill", target: state.nightWolfKill, source: "狼人刀人" }]
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const self = state.players.find((p) => p.name === player.name)
    // 存活到终局（结算时仍存活）且狼队胜利 → +0.5
    if (state.winCamp === "wolf" && self?.alive) {
      return [{ reason: "石像鬼存活至狼胜", delta: 0.5 }]
    }
    return []
  }

  extractState(
    player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> },
    _state: GameState,
  ): RoleSolverState {
    if (!player.alive) return {}
    return { gargoyleKilledTonight: !!player.mark.gargoyleKilledTonight }
  }
}
