import { BaseRole } from "./base"
import type { GameState } from "../logic"
import type { RoleDef, Effect, ScoreEntry, RoleSolverState } from "./types"

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
    intentKeys: ["nightProphetCheck"],
  }

  onNightResolve(state: GameState): Effect[] {
    return []
  }

  scoreRules(state: GameState, player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }): ScoreEntry[] {
    const entries: ScoreEntry[] = []
    const m = player.mark

    // 拿警徽
    if (state.jingHui === player.name) {
      entries.push({ reason: "拿警徽", delta: 0.5 })
    }

    // 验狼：每只 +0.5，不封顶（按标记计分，与存活/胜负方无关）
    const wolfCount = (m.prophetCheckWolf as number) || 0
    if (wolfCount > 0) {
      entries.push({ reason: `验狼×${wolfCount}`, delta: 0.5 * wolfCount })
    }

    // 未验人扣分：计数只在预言家存活时累加，故此处无需再判存活
    const nc = (m.prophetNoCheckCount as number) || 0
    if (nc > 0) {
      entries.push({ reason: `未验人${nc}晚`, delta: -0.5 * nc })
    }

    return entries
  }

  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return ((player.mark.prophetCheckWolf as number) || 0) > 0
  }

  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    // 预言家无特殊状态，仅计数
    return {}
  }
}
