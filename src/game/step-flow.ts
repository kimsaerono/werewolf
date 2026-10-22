import type { GameState } from "./logic"
import { getBoardRoles, isWolfRole, isWolfPackRole, getRoleInstance } from "./logic"
import { getRole, roleIds } from "./roles/registry"
import type { NightStepCtx, RoleDef } from "./roles/types"

export type { NightStepCtx } from "./roles/types"

/**
 * 夜晚/白天「当前步骤」编排（纯函数，便于测试）。
 *
 * 夜晚步骤顺序与启用条件由**角色注册表派生**（新增角色只要声明 nightStep 即自动纳入），
 * 与角色无关的特殊步骤（情侣认亲）单独列出。
 * 顺序按注册表 nightStep.order 升序；首夜石像鬼会被 computeStepKeys 额外挪到所有夜间步骤末尾
 * （需要目标的完整身份，必须等首夜角色分配完毕），第 2 夜起回归正常顺序。
 */

interface NightStep {
  key: string
  label: string
  emoji: string
  enabled: (c: NightStepCtx) => boolean
}

type OrderedNightStep = NightStep & { order: number }

/** 与角色无关的特殊夜间步骤 */
const SPECIAL_NIGHT_STEPS: OrderedNightStep[] = [
  { key: "loversMeet", label: "情侣认亲", emoji: "💑", order: 15, enabled: (c) => c.round <= 1 && c.lovers.length === 2 },
]

/** 特殊步骤占用的顺序号（查重测试用，避免角色 order 与之相撞） */
export const SPECIAL_NIGHT_STEP_ORDERS: readonly number[] = SPECIAL_NIGHT_STEPS.map((s) => s.order)

/** 缺省启用条件：板子含此角色，且该步骤尚未完成 */
function defaultStepEnabled(def: RoleDef): (c: NightStepCtx) => boolean {
  const key = def.nightStep!.key
  return (c) => c.boardRoles.includes(def.id) && !c.nightSteps[key]
}

/** 从角色注册表派生夜间步骤 */
function buildRoleNightSteps(): OrderedNightStep[] {
  const steps: OrderedNightStep[] = []
  for (const id of roleIds()) {
    const def = getRole(id)
    if (!def?.nightStep) continue
    steps.push({
      key: def.nightStep.key,
      label: def.nightStep.label ?? def.id,
      emoji: def.nightStep.emoji ?? def.emoji,
      order: def.nightStep.order,
      enabled: def.nightStep.enabled ?? defaultStepEnabled(def),
    })
  }
  return steps
}

/** 计算夜间步骤（每次从注册表重建，支持运行时动态注册角色） */
export function getNightActionSteps(): NightStep[] {
  return [...SPECIAL_NIGHT_STEPS, ...buildRoleNightSteps()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...step }) => step)
}

/** 夜间行动步骤快照（顺序 = order 升序，务必与历史流程一致） */
export const NIGHT_ACTION_STEPS: NightStep[] = getNightActionSteps()

/** 获取当前应执行的夜间步骤键（顺序即数组顺序，取「已启用且未完成」） */
export function getActiveNightStepKeys(ctx: NightStepCtx): string[] {
  const keys: string[] = []
  for (const step of getNightActionSteps()) {
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
      isWolfPack: isWolfPackRole,
      players: state.players,
      hunterExists: !!hunterP,
      hunterAlive: !!hunterP?.alive,
    })
    // 首夜角色是在夜间各步骤里逐个确认的；石像鬼需要目标的具体身份，
    // 故首夜把它挪到所有夜间步骤末尾（身份全部分配后再查验）。第 2 夜起保持前置顺序。
    if (state.round <= 1 && ks.includes("gargoyle")) {
      ks.splice(ks.indexOf("gargoyle"), 1)
      ks.push("gargoyle")
    }
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
