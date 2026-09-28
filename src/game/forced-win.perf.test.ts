import { describe, it, expect, mock } from "bun:test"
mock.module("./../../src/assets/roles/index.ts", () => ({ roleAvatar: () => "", randomDefaultAvatar: () => "" }))
const L: any = await import("./logic")
const { analyzeCertainty, clearForcedWinCache } = await import("./forced-win")

/**
 * 性能护栏。检测是在 computed 里同步跑的，单次求解必须远低于一帧（16ms 的数量级）。
 *
 * 阈值口径：单次 < 150ms、连续 30 次状态变化累计 < 600ms。两者都不是「实测值 + 一点余量」，
 * 而是按「最坏可达局面也不卡 UI」定的硬线。
 *
 * 采样用 3 次中位数而不是单次：求解过程要新建大量子局面对象，GC 抖动能让单次耗时翻倍，
 * 用单次采样做断言会随机红。中位数对抖动不敏感，又仍然能拦住「退化成整树遍历」这种量级回归。
 */
const SAMPLES = 3
const SINGLE_LIMIT = 150
const LOOP_LIMIT = 600

function build(roles: string[], mode: "edge" | "city", phase: "night" | "day") {
  const s: any = L.defaultState()
  s.judge = "法官"
  s.winMode = mode
  s.round = 1
  roles.forEach((r, i) => {
    const p = L.newPlayer(`P${i + 1}`)
    p.role = r
    s.players.push(p)
  })
  L.renumberPlayers(s)
  L.manualSaveRoles(s)
  s.phase = phase
  s.round = 1
  return s
}

function median(roles: string[], mode: "edge" | "city", phase: "night" | "day"): number {
  analyzeCertainty(build(roles, mode, phase)) // 预热，避开 JIT
  const times: number[] = []
  for (let i = 0; i < SAMPLES; i++) {
    clearForcedWinCache()
    const s = build(roles, mode, phase)
    const t0 = performance.now()
    analyzeCertainty(s)
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(SAMPLES / 2)]
}

describe("必然结束求解器 · 性能", () => {
  it("全部真实板子 × 两种判胜模式 × 昼夜两阶段，单次分析 < 150ms", () => {
    // 这一条才是真正约束用户路径的护栏：产品里能开局的面孔组合就是 boardConfig 里的这些，
    // 玩家能走到的每一个状态都源自其中之一。实测最坏 4.6ms（12k 屠城开局），
    // 离 150ms 有 30 倍余量，所以这条线卡的是量级回归，不是当前性能。
    let worst = 0
    for (const roles of Object.values(L.boardConfig as Record<string, string[]>)) {
      for (const mode of ["edge", "city"] as const) {
        for (const phase of ["night", "day"] as const) worst = Math.max(worst, median(roles, mode, phase))
      }
    }
    expect(worst).toBeLessThan(SINGLE_LIMIT)
  })

  it("大范围中局枚举（6 种神职搭配的 6 人屠城夜局）单次 < 150ms", () => {
    // 真实板子开局之后，中局会退化成「人更少 + 技能状态更复杂」的样子（女巫药已用、
    // 守卫已守过人、白痴已翻牌…）。用一组技能几乎齐全的小局面覆盖这一类，最慢实测 44ms。
    const HEAVY: Array<[string[], "edge" | "city"]> = [
      [["狼人", "预言家", "预言家", "猎人", "守卫", "骑士"], "city"],
      [["狼人", "狼人", "预言家", "女巫", "猎人", "守卫"], "city"],
      [["狼人", "狼人", "预言家", "猎人", "守卫", "骑士", "白痴"], "edge"],
      [["狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴"], "edge"],
    ]
    let worst = 0
    for (const [roles, mode] of HEAVY) {
      for (const phase of ["night", "day"] as const) worst = Math.max(worst, median(roles, mode, phase))
    }
    expect(worst).toBeLessThan(SINGLE_LIMIT)
  })

  it("连续 30 次状态变化累计 < 600ms", () => {
    // 面板每次状态变化都会重算一次。这里模拟真实节奏：同一局推进 30 次，
    // 缓存跨次命中（面板与胜率预测在同一轮渲染里各调一次，缓存本来就要跨调用存活）。
    const s = build(L.boardConfig["12"], "city", "night")
    analyzeCertainty(s) // 预热
    const t0 = performance.now()
    for (let i = 0; i < 30; i++) {
      s.round = 1 + (i % 4)
      s.players[3 + (i % 8)].alive = i % 2 === 0
      analyzeCertainty(s)
    }
    expect(performance.now() - t0).toBeLessThan(LOOP_LIMIT)
  })

  it("不可达的合成压力局（狼王 + 白狼王同场 + 6 神职）单次 < 900ms", () => {
    // 这个组合产品里开不出来：没有任何板子同时有狼王和白狼王，也没有板子同时带
    // 守卫 + 骑士 + 白痴 + 预言家 + 女巫 + 猎人。保留它是为了给搜索树的无上界留一个记录：
    // 真出现这种局面（例如未来加了自定义板子）时也要知道它有多贵，而不是悄悄卡住 UI。
    // 实测 320~450ms，所以这条线放到 900ms —— 它是「别再退化成整树遍历」的哨兵，
    // 不参与用户路径的 150ms 约束。
    const SYNTHETIC = ["狼人", "狼王", "白狼王", "预言家", "女巫", "猎人", "守卫", "骑士", "白痴", "平民", "平民", "平民", "平民"]
    let worst = 0
    for (const mode of ["edge", "city"] as const) {
      for (const phase of ["night", "day"] as const) worst = Math.max(worst, median(SYNTHETIC, mode, phase))
    }
    // 单组合中位数实测 62~772ms，断言线仍是 900ms；这里放宽的是 bun:test 默认 5s 的
    // 用例上限——本用例要跑 4 组 × (1 次预热 + 3 次采样) = 16 次全量搜索，
    // 叠加上同文件前两条用例留下的堆压力后总耗时超过 5s，与产品性能无关。
    expect(worst).toBeLessThan(900)
  }, 60_000)
})
