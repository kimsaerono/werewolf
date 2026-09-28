import type { GameState } from "./logic"
import type { DieReason, Effect } from "./roles/types"
import { killPlayer, pushNightLog, pushGlobalLog, pushFlow, isWolfRole } from "./logic"
import { getRoleInstance } from "./roles/builtin"

/**
 * 夜晚结算：收集所有角色的 Effect，按优先级排序，统一结算。
 * 这是 Phase 4 的核心：把 resolveNightDeath 中的硬编码逻辑改为角色驱动。
 */
export function resolveNightEffects(state: GameState): string | null {
  if (state.phase !== "night") return "当前不是夜晚，无法天亮结算"

  // 检查狼人步骤是否完成
  const aliveWolfExists = state.players.some((p) => p.alive && isWolfRole(p.role))
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

  // 兜底：如果狼人步骤已完成且有刀人目标，但没有狼人角色产生 kill 效果（狼人已全灭），则自动添加
  if (state.nightSteps.wolf && state.nightWolfKill) {
    const hasWolfKill = effects.some((e) => e.type === "kill" && e.source === "狼人刀人")
    if (!hasWolfKill) {
      effects.push({
        type: "kill",
        target: state.nightWolfKill,
        source: "狼人刀人",
      })
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
        const reason: DieReason = effect.source === "女巫毒药" ? "poison" : "wolfKill"
        // 毒药优先于狼刀（如果同一目标既有狼刀又有毒药，以毒药为准）
        if (!killed.has(effect.target) || reason === "poison") {
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

  // 解药判定：目标被 save 且被 kill
  for (const target of saved) {
    if (killed.has(target)) {
      killed.delete(target)
    }
  }

  // 执行死亡
  const deathList: string[] = []
  const poisonTarget = state.nightWitchPoison
  for (const [name, { reason }] of killed) {
    const p = state.players.find((x) => x.name === name)
    if (p && p.alive) {
      deathList.push(...killPlayer(state, name, reason))
      // 猎人/狼王开枪判定（与 main 分支保持一致）
      if (p.role === "猎人" && poisonTarget === name) {
        p.mark.hunterIsPoisoned = true
        pushNightLog(state, `⚠️猎人${name}被毒，本出局无法开枪`)
      }
      if (p.role === "猎人" && poisonTarget !== name) {
        state.hunterShotPending = true
        pushNightLog(state, `🔫猎人${name}被刀，可开枪`)
      }
      if (p.role === "狼王" && poisonTarget === name) {
        p.mark.wolfKingIsPoisoned = true
        pushNightLog(state, `⚠️狼王${name}被毒，本出局无法开枪`)
      }
      if (p.role === "狼王" && poisonTarget !== name) {
        state.wolfKingShotPending = true
        pushNightLog(state, `🔫狼王${name}被刀，可开枪`)
      }
    }
  }

  // 清理夜晚状态
  state.guardLastTarget = state.nightGuardTarget
  state.skipVote = false
  state.phase = "day"
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