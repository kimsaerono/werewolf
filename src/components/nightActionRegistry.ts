/**
 * 夜间行动步骤注册表（数据驱动，便于扩展）。
 *
 * 重要：此处的顺序与启用条件必须与历史 UI 行为**逐字一致**，
 * 因为夜晚行动顺序影响游戏流程。风格为「守卫→狼人→女巫→预言家→白痴→骑士→猎人」。
 */

export interface NightStepCtx {
  /** 板子角色列表（getBoardRoles，非玩家已分配角色） */
  boardRoles: string[]
  uiDone: Record<string, boolean>
  nightSteps: Record<string, boolean>
  round: number
  lovers: string[]
  isWolfRole: (role: string) => boolean
  players: { role: string; alive: boolean }[]
  /** 场上是否存在猎人玩家（可能尚未分配） */
  hunterExists: boolean
  hunterAlive: boolean
}

interface NightStep {
  key: string
  label: string
  emoji: string
  enabled: (c: NightStepCtx) => boolean
}

/** 夜间行动步骤（顺序即执行顺序，务必与历史保持一致） */
export const NIGHT_ACTION_STEPS: NightStep[] = [
  { key: "cupid", label: "丘比特连人", emoji: "💘", enabled: (c) => c.round <= 1 && c.boardRoles.includes("丘比特") },
  { key: "loversMeet", label: "情侣认亲", emoji: "💑", enabled: (c) => c.round <= 1 && c.lovers.length === 2 },
  {
    key: "guard",
    label: "守卫守人",
    emoji: "🛡️",
    enabled: (c) => c.boardRoles.includes("守卫") && !c.nightSteps.guard,
  },
  {
    key: "wolf",
    label: "狼人刀人",
    emoji: "🌑",
    enabled: (c) => {
      const quota = c.boardRoles.filter(c.isWolfRole).length
      const confirmed = c.players.filter((p) => c.isWolfRole(p.role)).length >= quota
      const aliveWolf = c.players.some((p) => p.alive && c.isWolfRole(p.role))
      return quota > 0 && (!confirmed || aliveWolf)
    },
  },
  {
    key: "witch",
    label: "女巫操作",
    emoji: "🧪",
    enabled: (c) => c.boardRoles.includes("女巫") && !c.nightSteps.witch,
  },
  { key: "prophet", label: "预言家验人", emoji: "🔮", enabled: (c) => c.boardRoles.includes("预言家") },
  { key: "idiotOpen", label: "白痴睁眼", emoji: "🙊", enabled: (c) => c.round <= 1 && c.boardRoles.includes("白痴") },
  { key: "knight", label: "骑士睁眼", emoji: "⚔️", enabled: (c) => c.round <= 1 && c.boardRoles.includes("骑士") },
  {
    key: "hunterOpen",
    label: "猎人睁眼",
    emoji: "🔫",
    enabled: (c) => c.boardRoles.includes("猎人") && (!c.hunterExists || c.hunterAlive),
  },
]

/**
 * 获取当前应执行的夜间步骤键列表（按顺序）。
 * 与历史 stepKeys 夜间分支完全等价：按注册表顺序取「已启用且未完成」的步骤。
 */
export function getActiveNightStepKeys(ctx: NightStepCtx): string[] {
  const keys: string[] = []
  for (const step of NIGHT_ACTION_STEPS) {
    if (step.enabled(ctx) && !ctx.uiDone[step.key]) keys.push(step.key)
  }
  return keys
}
