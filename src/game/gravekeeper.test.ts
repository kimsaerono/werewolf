import { describe, it, expect } from "bun:test"
import {
  defaultState,
  newPlayer,
  defaultMark,
  gravekeeperResult,
  finishVote,
  wolfBaoZha,
} from "./logic"
import { computeStepKeys } from "./step-flow"
import { resolveNightEffects } from "./night-resolver"
import type { GameState } from "./logic"

/** 构造含守墓人的测试局面 */
function makeState(roles: string[], opts: { round?: number } = {}): GameState {
  const st = defaultState()
  st.boardRoles = roles
  st.players = roles.map((r, i) => {
    const p = newPlayer("P" + (i + 1))
    p.role = r
    p.mark = defaultMark()
    return p
  })
  st.round = opts.round ?? 2
  st.phase = "night"
  st.uiDone = {}
  return st
}

describe("守墓人：步骤触发条件", () => {
  it("首夜步骤存在（仅用于确认身份），但无信息", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 1 })
    // 首夜仍需确认守墓人身份，故步骤存在；但技能不触发 → 无信息
    expect(computeStepKeys(st)).toContain("gravekeeper")
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("第二夜起出现守墓人步骤（顺序在预言家之后、白痴之前）", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "白痴", "平民"], { round: 2 })
    const keys = computeStepKeys(st)
    expect(keys).toContain("gravekeeper")
    expect(keys.indexOf("gravekeeper")).toBeGreaterThan(keys.indexOf("prophet"))
  })

  it("守墓人出局后技能失效（步骤仍保留照常念台词，但无信息）", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    st.players.find((p) => p.role === "守墓人")!.alive = false
    st.lastVoteOut = "P1"
    expect(computeStepKeys(st)).toContain("gravekeeper")
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("板子不含守墓人则无此步骤", () => {
    const st = makeState(["狼人", "预言家", "平民"], { round: 2 })
    expect(computeStepKeys(st)).not.toContain("gravekeeper")
  })
})

describe("守墓人：读取白天公投放逐阵营", () => {
  it("放逐狼人 → 狼人阵营", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    expect(finishVote(st, "P1", false)).toBeNull()
    const r = gravekeeperResult(st)
    expect(r).toEqual({ name: "P1", isWolf: true })
  })

  it("放逐好人 → 好人阵营", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    expect(finishVote(st, "P4", false)).toBeNull()
    const r = gravekeeperResult(st)
    expect(r).toEqual({ name: "P4", isWolf: false })
  })

  it("无人被放逐（空串）→ 无信息", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    st.lastVoteOut = ""
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("守墓人已出局 → 无信息", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    st.players.find((p) => p.role === "守墓人")!.alive = false
    st.lastVoteOut = "P1"
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("白痴被放逐翻牌免死 → 不算放逐，无信息", () => {
    const st = makeState(["狼人", "守墓人", "白痴", "平民"], { round: 2 })
    expect(finishVote(st, "P3", true)).toBeNull()
    expect(st.lastVoteOut).toBe("")
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("狼人自爆跳过投票（投票前）→ 本日无放逐，无信息", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    // 正常情况下本日黎明已清空；自爆不应写入放逐者
    st.lastVoteOut = ""
    expect(wolfBaoZha(st, "P1")).toBeNull()
    expect(st.lastVoteOut).toBe("")
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("公投放逐后不能再自爆 → 当天放逐信息保留", () => {
    const st = makeState(["狼人", "狼人", "守墓人", "预言家", "平民"], { round: 2 })
    st.phase = "day"
    expect(finishVote(st, "P1", false)).toBeNull()
    // 投票宣判后自爆被拒绝（只能在发言阶段自爆）
    expect(wolfBaoZha(st, "P2")).toContain("投票已结束")
    expect(st.lastVoteOut).toBe("P1")
    expect(gravekeeperResult(st)).toEqual({ name: "P1", isWolf: true })
  })

  it("天亮（黎明）清空上一白天的放逐信息（下一夜无残留）", () => {
    const st = makeState(["狼人", "守墓人", "预言家", "平民"], { round: 2 })
    st.phase = "day"
    expect(finishVote(st, "P1", false)).toBeNull()
    expect(gravekeeperResult(st)?.name).toBe("P1")
    // 进入夜晚后结算天亮
    st.phase = "night"
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.lastVoteOut).toBe("")
    expect(gravekeeperResult(st)).toBeNull()
  })
})
