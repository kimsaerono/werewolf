import type { GameState } from "./logic"
import type { DieReason, Effect } from "./roles/types"
import { killPlayer, pushNightLog, pushGlobalLog, pushFlow, isWolfPackRole, isEffectiveWolf, hiddenWolfCanKnife } from "./logic"
import { getRoleInstance } from "./roles/builtin"

/**
 * 夜晚结算：收集所有角色的 Effect，按优先级排序，统一结算。
 * 这是 Phase 4 的核心：把 resolveNightDeath 中的硬编码逻辑改为角色驱动。
 */
export function resolveNightEffects(state: GameState): string | null {
  if (state.phase !== "night") return "当前不是夜晚，无法天亮结算"

  // 检查狼人步骤是否完成（狼群或隐狼带刀时需要刀人步骤；被恐空刀也需确认空刀；石像鬼走自身步骤）
  const aliveWolfExists =
    state.players.some((p) => p.alive && isWolfPackRole(p.role)) || hiddenWolfCanKnife(state)
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
        // 恶灵骑士/猎魔人毒药免疫：女巫毒他时毒药消耗但不产生击杀效果
        if (effect.source === "女巫毒药") {
          const targetPlayer = state.players.find((x) => x.name === effect.target)
          const tid = targetPlayer ? getRoleInstance(targetPlayer.role)?.def.id : ""
          if (tid === "恶灵骑士" || tid === "猎魔人") {
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

  // 猎魔人：天亮结算狩猎（与女巫毒同口径，夜间已锁定目标则结算不受猎魔人当夜死亡影响）
  if (state.nightHuntTarget) {
    const hunter = state.players.find((p) => getRoleInstance(p.role)?.def.id === "猎魔人")
    const target = state.players.find((x) => x.name === state.nightHuntTarget)
    if (hunter && target && target.alive) {
      if (isEffectiveWolf(target)) {
        hunter.mark.huntWolfCount = (hunter.mark.huntWolfCount || 0) + 1
        deathList.push(...killPlayer(state, target.name, "other", "猎魔人狩猎"))
        pushGlobalLog(state, `🗡️猎魔人${hunter.name}狩猎命中：${target.name}是狼，出局`)
        pushFlow(state, "猎魔人结算", target.name, "戳中狼")
      } else {
        hunter.mark.huntGoodCount = (hunter.mark.huntGoodCount || 0) + 1
        if (hunter.alive) {
          deathList.push(...killPlayer(state, hunter.name, "other", "猎魔人反噬"))
          pushGlobalLog(state, `🗡️猎魔人${hunter.name}狩猎戳错好人：${target.name}，反噬出局`)
          pushFlow(state, "猎魔人结算", hunter.name, "戳错反噬")
        }
      }
    }
  }

  // 摄梦人结算
  const dreamer = state.players.find((p) => getRoleInstance(p.role)?.def.id === "摄梦人")
  if (dreamer) {
    const dreamTarget = state.nightDreamTarget
      ? state.players.find((x) => x.name === state.nightDreamTarget)
      : null
    const dreamerDiedTonight = !dreamer.alive && (killed.has(dreamer.name) || deathList.includes(dreamer.name))
    if (dreamerDiedTonight) {
      // 摄梦人夜间死亡 → 梦游者殉情（不开枪：不走 killPlayer 钩子）；白天放逐不触发
      if (dreamTarget && dreamTarget.alive) {
        dreamTarget.alive = false
        dreamTarget.deathReason = "lover"
        if (state.jingHui === dreamTarget.name) state.badgePending = dreamTarget.name
        deathList.push(dreamTarget.name)
        pushGlobalLog(state, `💔梦游者${dreamTarget.name}因摄梦人${dreamer.name}夜间死亡而殉情`)
        pushFlow(state, "梦游者殉情", dreamTarget.name)
      }
    } else if (dreamTarget && dreamer.alive && state.nightDreamTarget === dreamer.mark.prevDreamTarget) {
      // 连续两晚同梦 → 天亮连梦死亡
      if (dreamTarget.alive) {
        if (isEffectiveWolf(dreamTarget)) {
          dreamer.mark.dreamKillWolf = (dreamer.mark.dreamKillWolf || 0) + 1
        } else {
          dreamer.mark.dreamKillGood = (dreamer.mark.dreamKillGood || 0) + 1
        }
        deathList.push(...killPlayer(state, dreamTarget.name, "other", "摄梦连梦"))
        pushGlobalLog(state, `💭连续两晚同梦，${dreamTarget.name}在梦境中死去`)
        pushFlow(state, "摄梦连梦结算", dreamTarget.name)
      }
    }
    // 更新连梦基准（当晚未入梦则链断裂）
    dreamer.mark.prevDreamTarget = state.nightDreamTarget || ""
  }

  // 血月使徒延迟出局：白天被放逐但血月之力延续到天亮，期间可行动/自爆
  for (const p of state.players) {
    if (p.alive && p.mark.bloodDelayedExile) {
      p.mark.bloodDelayedExile = false
      deathList.push(...killPlayer(state, p.name, "vote", "血月延迟出局"))
      pushGlobalLog(state, `🌕血月使徒${p.name}血月之力耗尽，倒地出局`)
      pushFlow(state, "血月延迟结算", p.name)
    }
  }

  // 清理恶灵骑士每夜标记
  for (const p of state.players) {
    p.mark.dreadKnightCheckedTonight = false
    p.mark.dreadKnightPoisonedTonight = false
    p.mark.gargoyleKilledTonight = false
    // 恐惧封印仅持续当夜
    p.mark.skillDisabled = false
  }
  // 清理夜晚状态（血月封印作用于当夜，天亮清除）
  state.guardLastTarget = state.nightGuardTarget
  state.nightmareFearTarget = ""
  state.wolfFearedTonight = false
  state.bloodMoonSeal = false
  state.nightHuntTarget = ""
  state.nightDreamTarget = ""
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