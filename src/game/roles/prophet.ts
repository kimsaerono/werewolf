import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry } from "./types"

/**
 * 预言家角色：每晚可查验一人阵营。
 */
export class ProphetRole extends BaseRole {
  readonly def: RoleDef = {
    id: "预言家",
    camp: "god",
    unique: true,
    emoji: "🔮",
    short: "预",
    nightStep: { order: 15, key: "prophet" },
    intentKeys: ["nightProphetCheck"],
  }

  onNightResolve(state: GameState): Effect[] {
    // 预言家没有直接的夜晚效果（验人只是获取信息，不产生 kill/save/block）
    return []
  }

  scoreRules(state: GameState, player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark

    // 拿警徽
    if (state.jingHui === player.name) {
      entries.push({ reason: "拿警徽", delta: 0.5 })
    }

    // 预言家死亡后，验人相关分数不再计算（仅流程性验人）
    if (player.alive) {
      // 验狼
      if (m.prophetCheckWolf) {
        entries.push({ reason: "验狼", delta: 0.5 })
      }

      // 验好人
      if (m.prophetCheckGood) {
        entries.push({ reason: "验好人", delta: 0.5 })
      }

      // 首夜验狼
      if (m.prophetFirstDayWolf) {
        entries.push({ reason: "首夜验狼", delta: 0.5 })
      }

      // 未验人扣分
      const nc = (m.prophetNoCheckCount as number) || 0
      if (nc > 0) {
        entries.push({ reason: `未验人${nc}晚`, delta: -0.5 * nc })
      }
    }

    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return !!player.mark.prophetFirstDayWolf
  }
}