export type Camp = "wolf" | "god" | "villager" | "third"

/** 角色死亡事件（Phase 2 起在死亡管线中派发） */
export interface DieEvent {
  name: string
  reason: "vote" | "wolfKill" | "poison" | "selfBomb" | "duel" | "shot" | "lover" | "other"
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

  /** 夜晚行动步骤（Phase 4a 起驱动流程编排） */
  nightStep?: {
    /** 行动顺序，数字小者先行动（替代 stepKeys 硬编码推送位置） */
    order: number
    /** 完成标记键（写入 state.uiDone[key]） */
    key: string
    /** 仅首夜出现 */
    firstNightOnly?: boolean
  }
  /** 夜晚结算优先级（Phase 4a 起驱动 resolveOrder 结算） */
  resolveOrder?: number
  /** 该角色夜晚意图字段名（Phase 4a 起声明式重置） */
  intentKeys?: readonly string[]

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
