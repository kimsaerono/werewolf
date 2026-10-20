export type Camp = "wolf" | "god" | "villager" | "third"

/** 出局原因（killPlayer 唯一死亡入口会记录在 Player.deathReason） */
export type DieReason =
  | "vote"
  | "wolfKill"
  | "poison"
  | "selfBomb"
  | "duel"
  | "shot"
  | "lover"
  | "other"

/** 角色死亡事件（死亡管线中派发） */
export interface DieEvent {
  name: string
  reason: DieReason
  /** 死因来源（如 "恶灵骑士反伤"），可选，旧调用不传 */
  source?: string
}

/** 夜晚结算产出（Phase 4a 统一结算用） */
export interface Effect {
  type: "kill" | "save" | "block"
  target: string
  source: string
}

/** 结构化计分条目（Phase 5 替换 scoreDetail 字符串数组） */
export interface ScoreEntry {
  reason: string
  delta: number
}

/** 求解器角色状态（Phase 3：GoodNode 动态化） */
export interface RoleSolverState {
  [key: string]: unknown
}

/** 夜间步骤编排上下文（step-flow 计算「当前步骤」用） */
export interface NightStepCtx {
  /** 板子角色列表（getBoardRoles，非玩家已分配角色） */
  boardRoles: string[]
  uiDone: Record<string, boolean>
  nightSteps: Record<string, boolean>
  round: number
  lovers: string[]
  isWolfRole: (role: string) => boolean
  /** 是否狼群成员（参与狼人会议/刀人；石像鬼为 false）。可选，缺省回退 isWolfRole */
  isWolfPack?: (role: string) => boolean
  players: { role: string; alive: boolean }[]
  /** 场上是否存在猎人玩家（可能尚未分配） */
  hunterExists: boolean
  hunterAlive: boolean
}

/**
 * 角色定义：新增角色只需注册一条 RoleDef，核心流程代码零改动。
 * 各生命周期钩子均为可选，未实现的角色无需实现空方法。
 */
export interface RoleDef {
  /** 角色 id（与现有中文字符串一致，如 "狼人"） */
  id: string
  /** 阵营：狼 / 神 / 民 / 第三方 */
  camp: Camp
  /** 是否唯一角色（每局至多 1 个，替代 UNIQUE_ROLES） */
  unique: boolean
  /** 头像表情（替代 ROLE_EMOJI） */
  emoji: string
  /** 角色简写（替代 ROLE_SHORT） */
  short: string
  /**
   * 是否视为"神牌"（狼王枪带人计分口径）。
   * 默认取 camp === "god"；白痴等名义神职但按口径不算神牌的角色显式设为 false。
   */
  countsAsGod?: boolean

  /**
   * 是否属于「狼群」：参与狼人会议/刀人、与普通狼互通身份。
   * 默认 true（camp === "wolf" 即为狼群成员）。石像鬼为 false（独自行动、不与狼见面）。
   */
  wolfPack?: boolean

  /**
   * 夜晚行动步骤（Phase 4a 起驱动流程编排）。
   * 仅「拥有独立夜间 UI 步骤」的角色需要声明；其 key 必须出现在
   * step-flow 的 NIGHT_ACTION_STEPS 中，否则由 parity 测试拦截（防静默漏接）。
   * 与狼人共用同一刀人步骤的角色（白狼王/狼王）以及无夜间行动的角色（平民）无需声明。
   */
  nightStep?: {
    /** 行动顺序，数字小者先行动（step-flow 按此排序） */
    order: number
    /** 完成标记键（对应 step-flow 步骤 key / state.uiDone[key]） */
    key: string
    /** 步骤显示名（缺省取角色 id） */
    label?: string
    /** 步骤图标（缺省取角色 emoji） */
    emoji?: string
    /**
     * 该步骤是否启用。缺省为「板子含此角色且未完成」。
     * 需要更复杂条件（首夜限定 / 存活校验 / 狼人配额）的角色在此覆盖。
     */
    enabled?: (ctx: NightStepCtx) => boolean
  }
  /** 夜晚结算优先级（预留字段，当前流程未读取，勿依赖） */
  resolveOrder?: number
  /** 该角色夜晚意图字段名（Phase 4a 起声明式重置） */
  intentKeys: readonly string[]

  /** 自定胜负规则（Phase 4a 起参与 checkWin 规则管线） */
  winRule?: {
    priority: number
    judge: (state: unknown) => { camp: Camp | "draw"; reason: string } | null
  }
  /** 胜负后高光判定（Phase 5 替代 suggestHonor 内 if 链） */
  highlight?: (player: unknown) => boolean

  hooks?: {
    onBeforeDeath?: (state: unknown, evt: DieEvent) => boolean
    onNightResolve?: (state: unknown) => Effect[]
    onSheriffDie?: (state: unknown, evt: DieEvent) => void
    scoreRules?: (state: unknown, player: unknown) => ScoreEntry[]
  }
}
