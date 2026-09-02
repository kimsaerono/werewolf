import type { GameState } from "../logic"
import type { Camp, DieReason, RoleDef, DieEvent, Effect, ScoreEntry } from "./types"

/**
 * 角色基类：提供生命周期钩子的默认空实现。
 * 新增角色只需继承此类，覆盖需要的方法即可。
 */
export abstract class BaseRole {
  /** 角色定义（静态元数据） */
  abstract readonly def: RoleDef

  /** 死亡前钩子：返回 true 则拦截死亡（如白痴翻牌免死） */
  onBeforeDeath(state: GameState, evt: DieEvent): boolean {
    return false
  }

  /** 死亡后钩子：处理死亡后的逻辑（如猎人/狼王设置开枪标记） */
  onAfterDeath(state: GameState, evt: DieEvent & { killed: string[] }): void {
    // 默认无行为
  }

  /** 夜晚结算：返回夜晚意图/效果 */
  onNightResolve(state: GameState): Effect[] {
    return []
  }

  /** 警长死亡时 */
  onSheriffDie(state: GameState, evt: DieEvent): void {
    // 默认无行为
  }

  /** 算分规则 */
  scoreRules(state: GameState, player: { name: string; role: string; mark: Record<string, unknown> }): ScoreEntry[] {
    return []
  }

  /**
   * 胜负判定：返回该角色的胜负判定结果。
   * 返回 null 表示该角色不参与胜负判定（由其他角色或默认规则决定）。
   */
  winRule(state: GameState): { camp: Camp | "draw"; reason: string } | null {
    return null
  }

  /**
   * 高光判定：判断该玩家是否在本局有高光表现（用于 MVP/SVP 推荐）。
   * 返回 true 表示该玩家有高光表现。
   */
  highlight(player: { name: string; role: string; mark: Record<string, unknown> }): boolean {
    return false
  }
}