import type { GameState } from "./logic"
import { getBoardRoles, isWolfRole, getRoleInstance } from "./logic"

/**
 * 夜晚/白天「当前步骤」编排（纯函数，便于测试）。
 *
 * 重要：夜晚步骤的顺序与启用条件必须与历史 UI 行为**逐字一致**，
 * 因为夜晚行动顺序直接影响游戏流程。顺序为：
 *   丘比特 → 情侣认亲 → 守卫 → 狼人 → 女巫 → 预言家 → 白痴 → 骑士 → 猎人 → 警长 → 天亮
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

/** 夜间行动步骤（数组顺序即执行顺序，务必与历史保持一致） */
export const NIGHT_ACTION_STEPS: NightStep[] = [
  { key: "cupid", label: "丘比特连人", emoji: "💘", enabled: (c) => c.round <= 1 && c.boardRoles.includes("丘比特") },
  { key: "loversMeet", label: "情侣认亲", emoji: "💑", enabled: (c) => c.round <= 1 && c.lovers.length === 2 },
  { key: "guard", label: "守卫守人", emoji: "🛡️", enabled: (c) => c.boardRoles.includes("守卫") && !c.nightSteps.guard },
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
  { key: "witch", label: "女巫操作", emoji: "🧪", enabled: (c) => c.boardRoles.includes("女巫") && !c.nightSteps.witch },
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

/** 获取当前应执行的夜间步骤键（顺序即数组顺序，取「已启用且未完成」） */
export function getActiveNightStepKeys(ctx: NightStepCtx): string[] {
  const keys: string[] = []
  for (const step of NIGHT_ACTION_STEPS) {
    if (step.enabled(ctx) && !ctx.uiDone[step.key]) keys.push(step.key)
  }
  return keys
}

function findRolePlayer(state: GameState, roleId: string) {
  return state.players.find((p) => {
    const r = getRoleInstance(p.role)
    return r && r.def.id === roleId
  })
}

/**
 * 计算当前步骤序列（取首项即 currentStep）。
 * 覆盖 idle / night / day / skipVote / finished 全部阶段。
 */
export function computeStepKeys(state: GameState): string[] {
  if (state.finished) return ["end"]
  if (state.phase === "idle") return ["idle"]

  const uiDone = state.uiDone

  if (state.phase === "night") {
    const hunterP = findRolePlayer(state, "猎人")
    const ks = getActiveNightStepKeys({
      boardRoles: getBoardRoles(state),
      uiDone,
      nightSteps: state.nightSteps,
      round: state.round,
      lovers: state.lovers,
      isWolfRole,
      players: state.players,
      hunterExists: !!hunterP,
      hunterAlive: !!hunterP?.alive,
    })
    // 首夜所有角色睁眼后先竞选警长，再天亮公布死讯
    if (state.round <= 1 && !uiDone.jinghui) ks.push("jinghui")
    if (ks.length === 0) ks.push("dawn")
    return ks
  }

  // 白天：自爆跳过投票时优先处理待开枪
  if (state.skipVote) {
    if (state.wolfKingShotPending) return ["wolfkingShot"]
    if (state.hunterShotPending) return ["hunter"]
    return ["night"]
  }

  const ks: string[] = []
  const roles = getBoardRoles(state)
  if (state.wolfKingShotPending) ks.push("wolfkingShot")
  if (state.hunterShotPending) ks.push("hunter")
  if (state.round <= 1 && roles.includes("预言家") && !uiDone.prophetReport) ks.push("prophetReport")
  if (!uiDone.speech) ks.push("speech")
  if (!uiDone.vote) ks.push("vote")
  ks.push("night")
  return ks
}
