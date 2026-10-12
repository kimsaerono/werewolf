import type { GameState } from "../game/logic"
import type { Component } from "vue"

/** 夜间行动步骤配置 */
export interface NightActionStep {
  /** 步骤键（对应 state.uiDone[key] / state.nightSteps[key]） */
  key: string
  /** 显示标签 */
  label: string
  /** 表情 */
  emoji: string
  /** 角色是否存在检查（可选，用于决定是否显示确认身份或直接操作） */
  hasRole?: (state: GameState) => boolean
  /** 获取角色对象（可选） */
  getRoleObj?: (state: GameState) => { name: string; alive: boolean } | null
  /** 自定义渲染函数（返回 VNode 内容字符串或组件） */
  render?: (state: GameState, actions: any, refs: any) => any
}

/** 夜间行动注册表：按 nightStep.order 排序 */
export const NIGHT_ACTION_STEPS: NightActionStep[] = [
  {
    key: "cupid",
    label: "丘比特连人",
    emoji: "💘",
    hasRole: (s) => s.players.some((p) => p.role === "丘比特"),
    getRoleObj: (s) => s.players.find((p) => p.role === "丘比特") ?? null,
  },
  {
    key: "loversMeet",
    label: "情侣认亲",
    emoji: "💑",
    hasRole: (s) => s.lovers.length === 2,
  },
  {
    key: "guard",
    label: "守卫守人",
    emoji: "🛡️",
    hasRole: (s) => s.players.some((p) => p.role === "守卫"),
    getRoleObj: (s) => s.players.find((p) => p.role === "守卫") ?? null,
  },
  {
    key: "wolf",
    label: "狼人刀人",
    emoji: "🌑",
    hasRole: (s) => s.players.some((p) => p.role === "狼人" || p.role === "狼王" || p.role === "白狼王"),
    getRoleObj: (s) => s.players.find((p) => p.role === "狼人" || p.role === "狼王" || p.role === "白狼王") ?? null,
  },
  {
    key: "prophet",
    label: "预言家验人",
    emoji: "🔮",
    hasRole: (s) => s.players.some((p) => p.role === "预言家"),
    getRoleObj: (s) => s.players.find((p) => p.role === "预言家") ?? null,
  },
  {
    key: "witch",
    label: "女巫操作",
    emoji: "🧪",
    hasRole: (s) => s.players.some((p) => p.role === "女巫"),
    getRoleObj: (s) => s.players.find((p) => p.role === "女巫") ?? null,
  },
  {
    key: "hunterOpen",
    label: "猎人睁眼",
    emoji: "🔫",
    hasRole: (s) => s.players.some((p) => p.role === "猎人"),
    getRoleObj: (s) => s.players.find((p) => p.role === "猎人") ?? null,
  },
  {
    key: "idiotOpen",
    label: "白痴睁眼",
    emoji: "🙊",
    hasRole: (s) => s.players.some((p) => p.role === "白痴"),
    getRoleObj: (s) => s.players.find((p) => p.role === "白痴") ?? null,
  },
  {
    key: "knight",
    label: "骑士睁眼",
    emoji: "⚔️",
    hasRole: (s) => s.players.some((p) => p.role === "骑士"),
    getRoleObj: (s) => s.players.find((p) => p.role === "骑士") ?? null,
  },
]

/** 白天特殊步骤（不在夜间流程中） */
export const DAY_ACTION_STEPS: NightActionStep[] = [
  { key: "dawn", label: "天亮了", emoji: "🌅" },
  { key: "hunter", label: "猎人开枪", emoji: "🔫" },
  { key: "wolfkingShot", label: "狼王开枪", emoji: "🔫" },
  { key: "jinghui", label: "竞选警长", emoji: "👑" },
]

/** 获取当前应执行的步骤键列表（按顺序） */
export function getActiveStepKeys(state: GameState): string[] {
  const keys: string[] = []
  if (state.phase === "night") {
    for (const step of NIGHT_ACTION_STEPS) {
      if (step.hasRole?.(state) && !state.uiDone[step.key] && !state.nightSteps[step.key]) {
        keys.push(step.key)
      }
    }
  } else if (state.phase === "day") {
    for (const step of DAY_ACTION_STEPS) {
      if (!state.uiDone[step.key]) {
        keys.push(step.key)
      }
    }
  }
  return keys
}

/** 获取下一个待执行步骤 */
export function getNextStep(state: GameState): string | null {
  const keys = getActiveStepKeys(state)
  return keys[0] ?? null
}
