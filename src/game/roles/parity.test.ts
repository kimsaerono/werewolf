import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
// 注意：必须先导入 ../logic，确保 roles/registry 在正确的初始化顺序下完成注册表构建。
import { ALL_ROLE_OPT, UNIQUE_ROLES, ROLE_EMOJI, ROLE_SHORT } from "../logic"
import { getRole, roleIds, registerRole, unregisterRole } from "./registry"
import { BUILTIN_ROLES, getRoleInstance } from "./builtin"
import { NIGHT_ACTION_STEPS, getNightActionSteps, SPECIAL_NIGHT_STEP_ORDERS } from "../step-flow"
import { STEP_META } from "../ui/step-meta"

/**
 * 角色注册护栏。
 *
 * 目标：把「新增角色却漏接核心流程/元数据/界面」从静默失败变成测试红。
 * 以下都是加角色必须成立的硬约束，因此任何新角色都必须让本文件保持全绿。
 */

const VALID_CAMPS = new Set(["wolf", "god", "villager", "third"])
/** 实时的夜间步骤 key（含动态注册角色，避免依赖启动时的快照） */
const liveNightStepKeys = () => new Set(getNightActionSteps().map((s) => s.key))

/** 全部已注册角色 [id, def]（含内置 + 动态注册） */
function allDefs(): Array<[string, NonNullable<ReturnType<typeof getRole>>]> {
  const out: Array<[string, NonNullable<ReturnType<typeof getRole>>]> = []
  for (const id of roleIds()) {
    const d = getRole(id)
    if (d) out.push([id, d])
  }
  return out
}

describe("角色注册护栏：def ↔ instance 一致性", () => {
  it("每个内置角色都有对应实例，且实例与 def 元数据一致", () => {
    for (const d of BUILTIN_ROLES) {
      const inst = getRoleInstance(d.id)
      expect(inst, `角色 ${d.id} 缺少实例`).toBeTruthy()
      expect(inst!.def.id, `${d.id} id`).toBe(d.id)
      expect(inst!.def.camp, `${d.id} camp`).toBe(d.camp)
      expect(inst!.def.unique, `${d.id} unique`).toBe(d.unique)
      expect(inst!.def.emoji, `${d.id} emoji`).toBe(d.emoji)
      expect(inst!.def.short, `${d.id} short`).toBe(d.short)
    }
  })
})

describe("角色注册护栏：夜间步骤元数据", () => {
  it("nightStep.key 与 order 全局唯一（含特殊步骤占号）", () => {
    const withStep = allDefs().filter(([, d]) => d.nightStep)
    const keys = withStep.map(([, d]) => d.nightStep!.key)
    const orders = [...withStep.map(([, d]) => d.nightStep!.order), ...SPECIAL_NIGHT_STEP_ORDERS]
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it("任何被声明的夜间步骤 key 都必然被流程消费（派生保证，防回归）", () => {
    const live = liveNightStepKeys()
    const stray = allDefs()
      .filter(([, d]) => d.nightStep && !live.has(d.nightStep.key))
      .map(([id]) => id)
    expect(stray, "以下角色的夜间步骤未被流程消费").toEqual([])
  })
})

describe("角色注册护栏：元数据合法", () => {
  it("camp 合法、emoji/short 非空、unique 为布尔", () => {
    for (const [id, d] of allDefs()) {
      expect(VALID_CAMPS.has(d.camp), `角色 ${id} camp 非法: ${d.camp}`).toBe(true)
      expect(typeof d.emoji === "string" && d.emoji.length > 0, `角色 ${id} emoji 为空`).toBe(true)
      expect(typeof d.short === "string" && d.short.length > 0, `角色 ${id} short 为空`).toBe(true)
      expect(typeof d.unique === "boolean", `角色 ${id} unique 非布尔`).toBe(true)
    }
  })
})

describe("角色注册护栏：派生常量与注册表一致", () => {
  it("roleIds() 顺序与 BUILTIN_ROLES 一致", () => {
    expect(roleIds()).toEqual(BUILTIN_ROLES.map((d) => d.id))
  })

  it("ALL_ROLE_OPT / UNIQUE_ROLES / ROLE_EMOJI / ROLE_SHORT 由注册表派生", () => {
    expect(ALL_ROLE_OPT).toEqual(BUILTIN_ROLES.map((d) => d.id))
    expect([...UNIQUE_ROLES].sort()).toEqual(BUILTIN_ROLES.filter((d) => d.unique).map((d) => d.id).sort())
    for (const d of BUILTIN_ROLES) {
      expect(ROLE_EMOJI[d.id]).toBe(d.emoji)
      expect(ROLE_SHORT[d.id]).toBe(d.short)
    }
  })

  it("动态注册的角色会被派生常量与护栏识别", () => {
    registerRole({ id: "测试角色", camp: "wolf", unique: true, emoji: "🧪", short: "测", intentKeys: [] })
    try {
      expect(roleIds()).toContain("测试角色")
      expect(getRole("测试角色")?.camp).toBe("wolf")
    } finally {
      unregisterRole("测试角色")
    }
  })
})

describe("夜间步骤派生：顺序与元数据锁定", () => {
  it("NIGHT_ACTION_STEPS 顺序与历史流程逐字一致", () => {
    expect(NIGHT_ACTION_STEPS.map((s) => s.key)).toEqual([
      "wildChild",
      "cupid",
      "loversMeet",
      "guard",
      "gargoyleAssign",
      "gargoyle",
      "nightmare",
      "wolf",
      "hiddenWolf",
      "charm",
      "prophet",
      "hunterWolf",
      "dreamer",
      "witch",
      "gravekeeper",
      "idiotOpen",
      "knight",
      "hunterOpen",
      "bomberOpen",
    ])
  })

  it("每个步骤都有非空 label / emoji", () => {
    for (const s of NIGHT_ACTION_STEPS) {
      expect(s.label.length, `步骤 ${s.key} label 为空`).toBeGreaterThan(0)
      expect(s.emoji.length, `步骤 ${s.key} emoji 为空`).toBeGreaterThan(0)
    }
  })

  it("动态注册带 nightStep 的角色会自动出现在步骤列表（无需改 step-flow）", () => {
    registerRole({ id: "测试夜行者", camp: "god", unique: true, emoji: "🌙", short: "夜", intentKeys: [], nightStep: { order: 25, key: "testNightStep" } })
    try {
      const keys = getNightActionSteps().map((s) => s.key)
      expect(keys).toContain("testNightStep")
      // order=25 应排在 guard(20) 之后、wolf(30) 之前
      expect(keys.indexOf("testNightStep")).toBeGreaterThan(keys.indexOf("guard"))
      expect(keys.indexOf("testNightStep")).toBeLessThan(keys.indexOf("wolf"))
    } finally {
      unregisterRole("测试夜行者")
    }
  })
})

describe("界面覆盖护栏：每个夜间步骤都必须登记且有面板", () => {
  const GAMEPANEL = readFileSync(new URL("../../components/GamePanel.vue", import.meta.url), "utf8")
  const panelKeys = new Set(
    [...GAMEPANEL.matchAll(/(?:v-if|v-else-if)="currentStep === '([a-zA-Z_]+)'/g)].map((m) => m[1]),
  )
  const nightKeys = getNightActionSteps().map((s) => s.key)

  it("① 每个夜间步骤都在 STEP_META 登记（有标签/图标）", () => {
    const missing = nightKeys.filter((k) => !(k in STEP_META))
    expect(missing, `未登记到 STEP_META：${missing.join("、")}`).toEqual([])
  })

  it("② 每个夜间步骤在 GamePanel 都有对应面板分支", () => {
    const missing = nightKeys.filter((k) => !panelKeys.has(k))
    expect(missing, `GamePanel 缺少 currentStep 分支：${missing.join("、")}`).toEqual([])
  })
})
