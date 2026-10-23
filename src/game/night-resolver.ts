import type { GameState } from "./logic"
import type { DieReason, Effect } from "./roles/types"
import { killPlayer, pushNightLog, pushGlobalLog, pushFlow, isWolfPackRole, isEffectiveWolf, isEffectiveWolfPack, hiddenWolfCanKnife } from "./logic"
import { getRoleInstance } from "./roles/builtin"

/**
 * 夜晚结算：收集所有角色的 Effect，按优先级排序，统一结算。
 * 这是 Phase 4 的核心：把 resolveNightDeath 中的硬编码逻辑改为角色驱动。
 */
export function resolveNightEffects(state: GameState): string | null {
  if (state.phase !== "night") return "当前不是夜晚，无法天亮结算"

  // 检查狼人步骤是否完成（狼群或隐狼带刀时需要刀人步骤；被恐空刀也需确认空刀；石像鬼走自身步骤）
  const aliveWolfExists =
    state.players.some((p) => p.alive && isEffectiveWolfPack(p)) || hiddenWolfCanKnife(state)
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

  // 统一狼刀：只要还有存活的有效狼群成员（含黑化野孩子），就提交狼刀击杀。
  // 避免“噩梦/血月/恶灵骑士为唯一带刀狼”时只有刀口、没有击杀效果。
  if (state.nightWolfKill && state.players.some((p) => p.alive && isEffectiveWolfPack(p))) {
    effects.push({ type: "kill", target: state.nightWolfKill, source: "狼人刀人" })
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
        // 猎魔人毒免；恶灵骑士免疫夜间所有伤害（反伤用掉后仍不会被毒死）
        if (effect.source === "女巫毒药") {
          const targetPlayer = state.players.find((x) => x.name === effect.target)
          const tid = targetPlayer ? getRoleInstance(targetPlayer.role)?.def.id : ""
          if (tid === "恶灵骑士" || tid === "猎魔人") break
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

  // 梦游免疫：只挡外来夜间伤害（狼刀/毒药）；恶灵骑士反伤是技能结算惩罚，不挡。
  // 同一目标可能同时有“毒药 + 反伤”，killed 只会保留优先级更高的一个 source，
  // 因此按 effects 里的反伤目标集合判断，避免毒药 source 掩盖反伤导致误免。
  const revengeTargets = new Set(
    effects
      .filter((e) => e.type === "kill" && e.source === "恶灵骑士反伤")
      .map((e) => e.target),
  )
  for (const p of state.players) {
    if (p.mark.dreamShield && p.alive) {
      saved.delete(p.name)
      blocked.delete(p.name)
      if (!revengeTargets.has(p.name)) killed.delete(p.name)
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
  // 按夜间行动顺序结算：狼刀 → 女巫毒 → 恶灵骑士反伤；先达成条件者锁定胜局
  const sourcePriority: Record<string, number> = { 狼人刀人: 0, 女巫毒药: 1, 恶灵骑士反伤: 2 }
  const deathList: string[] = []
  const orderedDeaths = [...killed.entries()].sort(
    (a, b) => (sourcePriority[a[1].source] ?? 9) - (sourcePriority[b[1].source] ?? 9),
  )
  for (const [name, { reason, source }] of orderedDeaths) {
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
      const targetDreamImmune = !!target.mark.dreamShield
      if (getRoleInstance(target.role)?.def.id === "恶灵骑士") {
        // 恶灵骑士免疫夜间所有伤害：狩猎无法击杀（仍是狼，不反噬）
        pushGlobalLog(state, `🗡️猎魔人${hunter.name}的狩猎被恶灵骑士护体挡下：${target.name}毫发无伤`)
        pushFlow(state, "猎魔人结算", target.name, "护体挡下")
      } else if (isEffectiveWolf(target)) {
        if (targetDreamImmune) {
          // 目标的梦免只挡击杀，不牵涉反噬（狼目标本来就没有反噬）
          pushGlobalLog(state, `🗡️猎魔人${hunter.name}狩猎命中${target.name}是狼，但击杀被梦境免疫`)
          pushFlow(state, "猎魔人结算", target.name, "梦免击杀")
        } else {
          hunter.mark.huntWolfCount = (hunter.mark.huntWolfCount || 0) + 1
          deathList.push(...killPlayer(state, target.name, "other", "猎魔人狩猎"))
          pushGlobalLog(state, `🗡️猎魔人${hunter.name}狩猎命中：${target.name}是狼，出局`)
          pushFlow(state, "猎魔人结算", target.name, "戳中狼")
        }
      } else {
        // 好人目标：猎魔人反噬。反噬是自身技能结算惩罚，梦免不挡
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
    const dreamKillTarget = state.nightDreamKill
      ? state.players.find((x) => x.name === state.nightDreamKill)
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
    } else if (dreamKillTarget && dreamer.alive) {
      if (dreamKillTarget.alive && getRoleInstance(dreamKillTarget.role)?.def.id === "恶灵骑士") {
        // 恶灵骑士免疫夜间所有伤害：连梦梦杀无效
        pushGlobalLog(state, `💭连续两晚同梦，但${dreamKillTarget.name}的恶灵护体挡下了梦杀`)
        pushFlow(state, "摄梦连梦结算", dreamKillTarget.name, "护体挡下")
      } else if (dreamKillTarget.alive) {
        if (isEffectiveWolf(dreamKillTarget)) {
          dreamer.mark.dreamKillWolf = (dreamer.mark.dreamKillWolf || 0) + 1
        } else {
          dreamer.mark.dreamKillGood = (dreamer.mark.dreamKillGood || 0) + 1
        }
        deathList.push(...killPlayer(state, dreamKillTarget.name, "other", "摄梦连梦"))
        pushGlobalLog(state, `💭连续两晚同梦，${dreamKillTarget.name}在梦境中死去`)
        pushFlow(state, "摄梦连梦结算", dreamKillTarget.name)
      }
    }
    // 更新连梦基准（当晚未入梦则链断裂）
    dreamer.mark.prevDreamTarget = state.nightDreamTarget || state.nightDreamKill || ""
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
    // 梦游免疫仅持续当夜
    p.mark.dreamShield = false
  }
  // 清理夜晚状态（血月封印作用于当夜，天亮清除；警上自爆则顺延到下一夜）
  state.guardLastTarget = state.nightGuardTarget
  state.nightmareFearTarget = ""
  state.wolfFearedTonight = false
  if (state.bloodSealNextNight) {
    // 警上自爆：封印留给下一夜，下一夜天亮再清除
    state.bloodSealNextNight = false
  } else {
    state.bloodMoonSeal = false
  }
  state.nightHuntTarget = ""
  state.nightDreamTarget = ""
  state.nightDreamKill = ""
  if (state.skipDayAfterDawn) {
    // 警上自爆：跳过天亮后的白天（发言/投票），直接进入下一夜
    state.skipDayAfterDawn = false
    state.skipVote = true
  } else {
    state.skipVote = false
  }
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