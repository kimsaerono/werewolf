import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, DieEvent, Effect, RoleSolverState } from "./types"
import { killAsLover, pushNightLog, pushGlobalLog } from "../logic"

/**
 * 狼美人角色：狼人，每晚魅惑一人；被投票/毒杀/猎人枪杀出局时，被魅惑者殉情。
 * 同时作为狼人参与夜间刀人。
 *
 * 规则要点：
 * - 触发死因：投票 / 毒杀 / 猎人枪杀；被刀（禁止）/ 决斗 / 自爆 / 殉情均不触发。
 * - 不可连续两晚魅惑同一人。
 * - 殉情者不能开技能（走 killAsLover，绕开死亡钩子）。
 * - 狼美人禁止被刀、禁止自爆（由 logic 的 wolfKill / wolfBaoZha 拦截）。
 */
export class WolfBeautyRole extends BaseRole {
  readonly def: RoleDef = {
    id: "狼美人",
    camp: "wolf",
    unique: true,
    emoji: "🌹",
    short: "狼美",
    intentKeys: ["nightWolfKill", "charmedName"],
    nightStep: {
      order: 35,
      key: "charm",
      label: "狼美人魅惑",
      emoji: "🌹",
      enabled: (c) => c.boardRoles.includes("狼美人"),
    },
  }

  onNightResolve(state: GameState): Effect[] {
    const effects: Effect[] = []
    if (state.nightWolfKill) {
      effects.push({
        type: "kill",
        target: state.nightWolfKill,
        source: "狼人刀人",
      })
    }
    return effects
  }

  onAfterDeath(state: GameState, evt: DieEvent & { killed: string[] }): void {
    // 仅投票 / 毒杀 / 猎人枪杀触发殉情
    if (evt.reason !== "vote" && evt.reason !== "poison" && evt.reason !== "shot") return
    const targetName = state.charmedName
    if (!targetName) return
    const target = state.players.find((x) => x.name === targetName)
    if (!target || !target.alive) return

    const dead = killAsLover(state, targetName)
    for (const n of dead) {
      if (!evt.killed.includes(n)) evt.killed.push(n)
    }
    pushNightLog(state, `💔狼美人${evt.name}出局，被魅惑者${targetName}殉情`)
    pushGlobalLog(state, `💔${targetName}遭狼美人殉情出局`)
  }

  extractState(
    player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> },
    state: GameState,
  ): RoleSolverState {
    if (!player.alive) return {}
    return { charmed: state.charmedName }
  }
}
