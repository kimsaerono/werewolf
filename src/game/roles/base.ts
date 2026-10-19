import type { GameState } from "../logic"
import type { Camp, DieReason, RoleDef, DieEvent, Effect, ScoreEntry } from "./types"

/**
 * 求解器需要的特殊状态（Phase 3：动态化 GoodNode）
 * 各角色通过 extractState 返回其特有状态
 */
export interface RoleSolverState {
  /** 角色特有的求解器状态键值对 */
  [key: string]: unknown
}

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

  /** 被预言家查验时触发（恶灵骑士反伤用），checkerName 为预言家玩家名 */
  onBeingChecked(state: GameState, checkerName: string): void {
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
   * 是否视为"神牌"（狼王枪带人计分口径）。
   * 默认取 def.countsAsGod，未显式声明时按 camp === "god" 判定。
   */
  countsAsGod(): boolean {
    return this.def.countsAsGod ?? this.def.camp === "god"
  }

  /**
   * 被白狼王自爆带走时，给白狼王带来的计分条目（null = 不计分）。
   * 默认不计分；女巫/守卫/未开技能骑士等角色按规则覆盖。
   */
  selfBombScore(state: GameState): ScoreEntry | null {
    return null
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

  /**
   * 提取求解器状态（Phase 3：GoodNode 动态化）
   * 返回该角色特有的状态，用于求解器建模
   * 默认返回空对象
   */
  extractState(player: { name: string; role: string; alive: boolean; mark: Record<string, unknown> }, state: GameState): RoleSolverState {
    return {}
  }
}