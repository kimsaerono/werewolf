import { describe, it, expect } from "bun:test"
import {
  defaultState,
  newPlayer,
  defaultMark,
  isWolfRole,
  isWolfPackRole,
  gargoyleCheck,
  gargoyleCanKill,
  gargoyleKill,
  gargoyleEmptyKill,
  prophetCheck,
  wolfBaoZha,
  wolfKill,
  recalcScore,
  nextNight,
  finishGameAuto,
} from "./logic"
import { resolveNightEffects } from "./night-resolver"
import { computeStepKeys } from "./step-flow"
import type { GameState } from "./logic"

/** 构造含石像鬼的测试局面 */
function makeState(roles: string[], opts: { round?: number } = {}): GameState {
  const st = defaultState()
  st.boardRoles = roles
  st.players = roles.map((r, i) => {
    const p = newPlayer("P" + (i + 1))
    p.role = r
    p.mark = defaultMark()
    return p
  })
  st.round = opts.round ?? 1
  st.phase = "night"
  st.uiDone = {}
  return st
}

describe("石像鬼：狼群外身份", () => {
  it("camp=wolf 但 wolfPack=false（isWolfRole=true, isWolfPackRole=false）", () => {
    expect(isWolfRole("石像鬼")).toBe(true)
    expect(isWolfPackRole("石像鬼")).toBe(false)
    expect(isWolfPackRole("狼人")).toBe(true)
  })

  it("预言家查验石像鬼 → 狼人", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    const r = prophetCheck(st, "P2")
    expect(typeof r === "object" && r !== null && r.isWolf).toBe(true)
  })

  it("第二夜起：石像鬼在 wolf 之前、guard 之后", () => {
    const st = makeState(["狼人", "石像鬼", "守卫", "预言家", "平民"], { round: 2 })
    const keys = computeStepKeys(st)
    expect(keys).toContain("gargoyle")
    expect(keys.indexOf("gargoyle")).toBeGreaterThan(keys.indexOf("guard"))
    expect(keys.indexOf("gargoyle")).toBeLessThan(keys.indexOf("wolf"))
  })

  it("首夜石像鬼挪到所有夜间步骤之后（等身份确认完再查验）", () => {
    const st = makeState(["狼人", "石像鬼", "守卫", "预言家", "猎人", "平民"], { round: 1 })
    const keys = computeStepKeys(st)
    expect(keys.indexOf("gargoyle")).toBeGreaterThan(keys.indexOf("wolf"))
    expect(keys.indexOf("gargoyle")).toBeGreaterThan(keys.indexOf("hunterOpen"))
    expect(keys.indexOf("gargoyle")).toBeLessThan(keys.indexOf("jinghui"))
  })

  it("石像鬼是唯一狼角色时：仍有狼人环节（无人睁眼）与石像鬼步骤", () => {
    const st = makeState(["石像鬼", "预言家", "平民", "平民"])
    const keys = computeStepKeys(st)
    expect(keys).toContain("gargoyle")
    // 照常念狼人台词，避免语音暗示
    expect(keys).toContain("wolf")
    // 唯一狼即石像鬼，直接解锁刀人
    expect(gargoyleCanKill(st)).toBe(true)
  })

  it("石像鬼出局后步骤仍保留（照常念台词），但技能失效", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"], { round: 2 })
    st.players.find((p) => p.role === "石像鬼")!.alive = false
    expect(computeStepKeys(st)).toContain("gargoyle")
    expect(gargoyleCanKill(st)).toBe(false)
  })
})

describe("石像鬼：查验完整身份", () => {
  it("返回目标的具体角色，而非仅阵营", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    const r = gargoyleCheck(st, "P3")
    expect(r).toEqual({ name: "P3", role: "预言家" })
  })

  it("查验死亡的玩家被拒", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.players[2].alive = false
    expect(typeof gargoyleCheck(st, "P3")).toBe("string")
  })
})

describe("石像鬼：不能自爆", () => {
  it("wolfBaoZha(石像鬼) 被拒", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    expect(wolfBaoZha(st, "P2")).toMatch(/石像鬼不能自爆/)
  })
})

describe("石像鬼：解锁刀人", () => {
  it("仍有普通狼存活时不能刀人", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    expect(gargoyleCanKill(st)).toBe(false)
    expect(gargoyleKill(st, "P3")).toMatch(/尚未解锁/)
  })

  it("除石像鬼外狼全灭 → 解锁，刀人产生狼刀效果并结算出局", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    // 普通狼出局
    st.players[0].alive = false
    expect(gargoyleCanKill(st)).toBe(true)
    expect(gargoyleKill(st, "P3")).toBeNull()
    expect(st.nightWolfKill).toBe("P3")
    // 石像鬼不必走狼人步骤；结算应击杀 P3
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.players.find((p) => p.name === "P3")!.alive).toBe(false)
  })

  it("解锁后可空刀，结算无人死亡", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.players[0].alive = false
    expect(gargoyleEmptyKill(st)).toBeNull()
    expect(st.nightWolfKill).toBe("")
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.players.find((p) => p.name === "P3")!.alive).toBe(true)
  })

  it("石像鬼可被狼刀（作为刀人目标）", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    expect(wolfKill(st, "P2")).toBeNull()
    expect(st.nightWolfKill).toBe("P2")
  })
})

describe("石像鬼：与普通狼并存", () => {
  it("普通狼刀人正常结算，石像鬼验人不产生额外击杀", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.nightSteps.wolf = true
    st.nightWolfKill = "P3" // 普通狼刀预言家
    const r = gargoyleCheck(st, "P4") // 石像鬼验平民
    expect(typeof r === "object").toBe(true)
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.players.find((p) => p.name === "P3")!.alive).toBe(false)
    expect(st.players.find((p) => p.name === "P4")!.alive).toBe(true)
  })
})

describe("石像鬼：计分", () => {
  it("存活到终局且狼胜 +0.5", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.winCamp = "wolf"
    recalcScore(st)
    const g = st.players.find((p) => p.name === "P2")!
    expect(g.scoreDetail.some((d) => d.includes("石像鬼存活至狼胜"))).toBe(true)
  })

  it("已出局则不加这 0.5", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.players[1].alive = false
    st.winCamp = "wolf"
    recalcScore(st)
    const g = st.players.find((p) => p.name === "P2")!
    expect(g.scoreDetail.some((d) => d.includes("石像鬼存活至狼胜"))).toBe(false)
  })

  it("好人胜则不加这 0.5", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.winCamp = "god"
    recalcScore(st)
    const g = st.players.find((p) => p.name === "P2")!
    expect(g.scoreDetail.some((d) => d.includes("石像鬼存活至狼胜"))).toBe(false)
  })

  it("终局结算：狼胜且石像鬼存活 → 分数含 +0.5", () => {
    const st = makeState(["狼人", "石像鬼", "预言家", "平民"])
    st.players[0].alive = false // 普通狼出局，石像鬼存活
    st.winCamp = "wolf"
    expect(finishGameAuto(st)).toBeNull()
    const g = st.players.find((p) => p.name === "P2")!
    expect(g.scoreDetail.some((d) => d.includes("石像鬼存活至狼胜"))).toBe(true)
    expect(g.scoreRound).toBeGreaterThanOrEqual(3.5)
  })
})
