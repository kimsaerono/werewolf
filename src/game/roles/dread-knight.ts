import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry, RoleSolverState } from "./types"
import { getRoleInstance } from "./builtin"

/**
 * 恶灵骑士角色：狼阵营，共用狼人刀人步骤（不声明 nightStep）。
 * - 不能被狼人选为刀人目标（不能自刀），不能自爆
 * - 免疫夜间所有伤害：狼刀/毒药/猎魔人狩猎/摄梦连梦均杀不死（反伤用掉后仍免疫）
 * - 白天可被猎人开枪、放逐等正常击杀
 * - 女巫毒他：触发反伤（女巫天亮出局），毒药消耗但无效；反伤用掉后不再反伤
 * - 一次性反伤：预言家验他 或 女巫毒他 → 释放技能的神天亮结算出局（死因 other，解药救不回）
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
    const self = state.players.find((p) => getRoleInstance(p.role)?.def.id === "恶灵骑士")
    if (!self || !self.alive) return effects

    const checked = !!self.mark.dreadKnightCheckedTonight
    const poisoned = !!self.mark.dreadKnightPoisonedTonight
    const canRevenge = !self.mark.dreadKnightRevengeUsed

    // 反伤优先级：预言家验 > 女巫毒（同夜都触发只反弹预言家）
    const prophet = checked
      ? state.players.find((p) => p.alive && getRoleInstance(p.role)?.def.id === "预言家")
      : undefined
    const witch = poisoned
      ? state.players.find((p) => p.alive && getRoleInstance(p.role)?.def.id === "女巫")
      : undefined

    if (canRevenge && prophet) {
      effects.push({ type: "kill", target: prophet.name, source: "恶灵骑士反伤" })
      self.mark.dreadKnightRevengeUsed = true
      self.mark.dreadKnightRevengeCount = (self.mark.dreadKnightRevengeCount || 0) + 1
      self.mark.dreadKnightRevengeTarget = prophet.name
      // 同夜毒药没有拿到反伤（优先级让给预言家）→ 计一次「吸引毒药未反伤」
      if (poisoned) self.mark.dreadKnightPoisonNoRevenge = true
    } else if (canRevenge && witch) {
      effects.push({ type: "kill", target: witch.name, source: "恶灵骑士反伤" })
      self.mark.dreadKnightRevengeUsed = true
      self.mark.dreadKnightRevengeCount = (self.mark.dreadKnightRevengeCount || 0) + 1
      self.mark.dreadKnightRevengeTarget = witch.name
    } else {
      // 反伤已用掉（或反伤对象不在场）：本夜被验/被毒均计入「未反伤」
      if (checked) self.mark.dreadKnightCheckNoRevenge = true
      if (poisoned) self.mark.dreadKnightPoisonNoRevenge = true
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
    // 只有在「该次查验/毒药未触发反伤」时才计吸引分，避免反伤命中的同一夜重复加分
    if (m.dreadKnightCheckNoRevenge) {
      entries.push({ reason: "吸引查验未反伤", delta: 0.5 })
    }
    if (m.dreadKnightPoisonNoRevenge) {
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
