import type { GameState } from "./logic"
import type { DieReason, Effect } from "./roles/types"
import { killPlayer, pushNightLog, pushGlobalLog, pushFlow, isWolfPackRole } from "./logic"
import { getRoleInstance } from "./roles/builtin"

/**
 * 夜晚结算：收集所有角色的 Effect，按优先级排序，统一结算。
 * 这是 Phase 4 的核心：把 resolveNightDeath 中的硬编码逻辑改为角色驱动。
 */
export function resolveNightEffects(state: GameState): string | null {
  if (state.phase !== "night") return "当前不是夜晚，无法天亮结算"

  // 检查狼人步骤是否完成（仅普通狼群需要刀人步骤；石像鬼解锁后走自身步骤）
  const aliveWolfExists = state.players.some((p) => p.alive && isWolfPackRole(p.role))
  if (aliveWolfExists && !state.nightSteps.wolf) {
    return "狼人刀人步骤未完成，请先确认狼人刀人"
  }

  // 收集所有存活角色的夜晚效果
  const effects: Effect[] = []
  for (const player of state.players) {
    if (!player.alive) continue
    const role = getRoleInstance(player.role)
    if (role && role.onNightResolve) {
      const roleEffects = role.onNightResolve(state)
      effects.push(...roleEffects)
    }
  }

  // 按优先级排序：save > block > kill
  // save（女巫解药）优先级最高，block（守卫守护）次之，kill（狼刀/毒药）最后
  const priorityMap = { save: 0, block: 1, kill: 2 }
  effects.sort((a, b) => priorityMap[a.type] - priorityMap[b.type])

  // 结算
  const saved = new Set<string>()
  const blocked = new Map<string, string>() // target -> source
  const killed = new Map<string, { source: string; reason: DieReason }>()

  for (const effect of effects) {
    switch (effect.type) {
      case "save":
        saved.add(effect.target)
        break
      case "block":
        blocked.set(effect.target, effect.source)
        break
      case "kill": {
        // 恶灵骑士毒药免疫：女巫毒他时毒药消耗但不产生击杀效果
        if (effect.source === "女巫毒药") {
          const targetPlayer = state.players.find((x) => x.name === effect.target)
          if (targetPlayer && getRoleInstance(targetPlayer.role)?.def.id === "恶灵骑士") {
            break
          }
        }
        const reason: DieReason =
          effect.source === "女巫毒药" ? "poison" :
          effect.source === "恶灵骑士反伤" ? "other" :
          "wolfKill"
        // 毒药优先于狼刀；反伤优先于狼刀（同一目标）
        const existing = killed.get(effect.target)
        const existingPriority = existing ? (existing.reason === "poison" ? 3 : existing.reason === "other" ? 2 : 1) : -1
        const newPriority = reason === "poison" ? 3 : reason === "other" ? 2 : 1
        if (!existing || newPriority >= existingPriority) {
          killed.set(effect.target, { source: effect.source, reason })
        }
        break
      }
    }
  }

  // 同守同救判定：如果目标同时被 save 和 block，则双双无效
  const sameSaveKill = new Set<string>()
  for (const target of saved) {
    if (blocked.has(target)) {
      sameSaveKill.add(target)
      saved.delete(target)
      blocked.delete(target)

      // 标记守卫同守同救
      const guard = state.players.find((p) => {
        const role = getRoleInstance(p.role)
        return role && role.def.id === "守卫"
      })
      if (guard) guard.mark.guardSameSaveKill = true
    }
  }

  // 守中判定：目标被 block 且被狼刀（毒药无视守卫）
  for (const [target, blockSource] of blocked) {
    if (killed.has(target)) {
      const killInfo = killed.get(target)!
      // 只有狼刀会被守卫阻挡，毒药无视守卫
      if (killInfo.source === "狼人刀人") {
        killed.delete(target)

        // 标记守卫守中
        const guard = state.players.find((p) => {
          const role = getRoleInstance(p.role)
          return role && role.def.id === "守卫"
        })
        if (guard) guard.mark.guardHitCount = (guard.mark.guardHitCount || 0) + 1
      }
    }
  }

  // 解药判定：目标被 save 且被 kill（只解狼刀，不解毒药/反伤）
  for (const target of saved) {
    const killInfo = killed.get(target)
    if (killInfo && killInfo.reason === "wolfKill") {
      killed.delete(target)
    }
  }

  // 执行死亡（猎人/狼王开枪判定由各自的 onAfterDeath 钩子在 killPlayer 内触发）
  const deathList: string[] = []
  for (const [name, { reason, source }] of killed) {
    const p = state.players.find((x) => x.name === name)
    if (p && p.alive) {
      deathList.push(...killPlayer(state, name, reason, source))
    }
  }

  // 清理恶灵骑士每夜标记
  for (const p of state.players) {
    p.mark.dreadKnightCheckedTonight = false
    p.mark.dreadKnightPoisonedTonight = false
    p.mark.gargoyleKilledTonight = false
  }

  // 清理夜晚状态
  state.guardLastTarget = state.nightGuardTarget
  state.skipVote = false
  state.phase = "day"
  // 新白天开始：清空"上一白天放逐者"。守墓人已在刚结束的夜晚读取过，不受影响；
  // 当天若无人被公投放逐（无人出局/骑士跳票/自爆），下一夜即无信息。
  state.lastVoteOut = ""
  state.uiDone = {}

  // 播报
  if (deathList.length === 0) {
    pushGlobalLog(state, `☀️天亮，平安夜`)
    pushNightLog(state, `☀️天亮，平安夜`)
    pushFlow(state, "天亮", "", "平安夜")
  } else {
    const deaths = [...new Set(deathList)].join("、")
    pushGlobalLog(state, `☀️天亮，昨夜死亡：${deaths}`)
    pushNightLog(state, `☀️天亮，昨夜死亡：${deaths}`)
    pushFlow(state, "天亮", deaths)
  }

  return null
}