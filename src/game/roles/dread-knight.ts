import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry, RoleSolverState } from "./types"
import { getRoleInstance } from "./builtin"

/**
 * 恶灵骑士角色：狼阵营，共用狼人刀人步骤（不声明 nightStep）。
 * - 不能被狼人选为刀人目标（不能自刀）
 * - 女巫毒他：毒药消耗但不死（不设 witchPoWolf/witchPoGood）
 * - 一次性反伤：预言家验他 或 女巫毒他 → 释放技能的神天亮结算出局（死因 other）
 * - 反伤优先级：预言家 > 女巫（同夜都触发只反弹预言家）
 */
export class DreadKnightRole extends BaseRole {
  readonly def: RoleDef = {
    id: "恶灵骑士",
    camp: "wolf",
    unique: true,
    emoji: "🛡️🐺",
    short: "恶骑",
    intentKeys: ["nightWolfKill"],
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []
    // 反伤：一次性，触发后不再反弹
    const self = state.players.find((p) => getRoleInstance(p.role)?.def.id === "恶灵骑士")
    if (!self || !self.alive) return effects
    if (self.mark.dreadKnightRevengeUsed) return effects

    // 优先级：预言家验 > 女巫毒（同夜都触发只反弹预言家）
    if (self.mark.dreadKnightCheckedTonight) {
      const prophet = state.players.find((p) => p.alive && getRoleInstance(p.role)?.def.id === "预言家")
      if (prophet) {
        effects.push({ type: "kill", target: prophet.name, source: "恶灵骑士反伤" })
        self.mark.dreadKnightRevengeUsed = true
        self.mark.dreadKnightRevengeCount = (self.mark.dreadKnightRevengeCount || 0) + 1
        self.mark.dreadKnightRevengeTarget = prophet.name
      }
    } else if (self.mark.dreadKnightPoisonedTonight) {
      const witch = state.players.find((p) => p.alive && getRoleInstance(p.role)?.def.id === "女巫")
      if (witch) {
        effects.push({ type: "kill", target: witch.name, source: "恶灵骑士反伤" })
        self.mark.dreadKnightRevengeUsed = true
        self.mark.dreadKnightRevengeCount = (self.mark.dreadKnightRevengeCount || 0) + 1
        self.mark.dreadKnightRevengeTarget = witch.name
      }
    }

    return effects
  }

  onBeingChecked(state: GameState, checkerName: string): void {
    // 预言家验他：标记本夜被验（由 prophetCheck 调用，反伤在 onNightResolve 结算）
    // 标记已由 prophetCheck 设置，此处无需额外操作
  }

  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark
    const revengeCount = (m.dreadKnightRevengeCount as number) || 0
    if (revengeCount > 0) {
      entries.push({ reason: `反伤×${revengeCount}`, delta: revengeCount })
    }
    // 吸引查验但未反伤：曾被验，但反伤目标不是预言家（反伤已用掉或反弹了女巫）
    if (m.dreadKnightEverChecked && m.dreadKnightRevengeTarget !== "预言家") {
      entries.push({ reason: "吸引查验未反伤", delta: 0.5 })
    }
    // 吸引毒药但未反伤：曾被毒，但反伤目标不是女巫（反伤已用掉或反弹了预言家）
    if (m.dreadKnightEverPoisoned && m.dreadKnightRevengeTarget !== "女巫") {
      entries.push({ reason: "吸引毒药未反伤", delta: 0.5 })
    }
    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return ((player.mark.dreadKnightRevengeCount as number) || 0) > 0
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    if (!player.alive) return {}
    return {
      revengeUsed: !!player.mark.dreadKnightRevengeUsed,
    }
  }
}
