/**
 * 回滚（修改已同步对局）纯逻辑测试：定位复盘行、扣回排名、扣回法官分。
 * 与 sync-resilience.test.ts 一样，直接 require 部署端 server.cjs。
 */
import { describe, it, expect } from "bun:test"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const svc = require("../deploy/werewolf-sync/server.cjs") as {
  locateGameRowIndex: (
    rows: unknown[][],
    body: { gameId?: string; date?: string },
    layoutName?: string,
  ) => number | null
  deductRankingRows: (
    rankValues: unknown[][],
    entries: { name: string; win: boolean; score: number }[],
  ) => {
    updates: { row: number; vals: (number | string)[] }[]
    missing: string[]
  }
  deductJudgeRow: (
    rankValues: unknown[][],
    judge: { name: string; score: number } | null,
  ) => { row: number; score: number } | null
}

describe("locateGameRowIndex（回滚定位复盘行）", () => {
  const locate = svc.locateGameRowIndex

  it("F 布局：A 列首行含 gameId 即命中", () => {
    const rows = [
      ["🎮 真实·第1局 · 2026年11月6日\n🃏 板子：狼人×3"],
      ["🎮 真实·第2局 · 2026年11月6日\n🃏 板子：狼人×3"],
    ]
    expect(locate(rows, { gameId: "真实·第2局 · 2026年11月6日" }, "F")).toBe(2)
  })

  it("G 布局带 #标记：仍按首行 token 命中", () => {
    const rows = [["2026/11/6 12:26:31  第1局  🧑‍⚖️ 法官：柴  好人胜利  ｜ #真实·第1局 · 2026年11月6日"]]
    expect(locate(rows, { gameId: "真实·第1局 · 2026年11月6日" }, "G")).toBe(1)
  })

  it("G 旧布局无标记：按「原始时间串 + 第N局」兜底命中", () => {
    const rows = [
      ["2026/11/6 12:20:00  第1局  🧑‍⚖️ 法官：柴  狼人胜利"],
      ["2026/11/6 12:26:31  第2局  🧑‍⚖️ 法官：柴  好人胜利"],
    ]
    const body = { gameId: "真实·第2局 · 2026年11月6日", date: "2026/11/6 12:26:31" }
    expect(locate(rows, body, "G")).toBe(2)
  })

  it("找不到返回 null；且不会把「第11局」误配成「第1局」", () => {
    const rows = [["2026/11/6 12:26:31  第11局  🧑‍⚖️ 法官：柴  好人胜利"]]
    const body = { gameId: "真实·第1局 · 2026年11月6日", date: "2026/11/6 12:26:31" }
    expect(locate(rows, body, "G")).toBeNull()
  })
})

describe("deductRankingRows（扣回排名：场次/胜/负/胜率/积分）", () => {
  const rank = [
    [1, "甲", 5, 3, 2, "60.00%", 12],
    [2, "乙", 4, 1, 3, "25.00%", 5],
  ]

  it("胜者：场次-1、胜-1、积分-本轮分，胜率重算", () => {
    const { updates } = svc.deductRankingRows(rank, [{ name: "甲", win: true, score: 3 }])
    expect(updates[0]).toEqual({ row: 2, vals: [4, 2, 2, "50.00%", 9] })
  })

  it("负者：场次-1、负-1、积分-本轮分", () => {
    const { updates } = svc.deductRankingRows(rank, [{ name: "乙", win: false, score: 2 }])
    expect(updates[0]).toEqual({ row: 3, vals: [3, 1, 2, "33.33%", 3] })
  })

  it("同一玩家多行 entries 会分别扣（本函数按单局调用，仅校验单条）", () => {
    const { updates } = svc.deductRankingRows(rank, [{ name: "甲", win: false, score: 0.5 }])
    expect(updates[0].vals).toEqual([4, 3, 1, "75.00%", 11.5])
  })

  it("表里没有的玩家进 missing，不产生更新", () => {
    const { updates, missing } = svc.deductRankingRows(rank, [{ name: "丙", win: true, score: 3 }])
    expect(updates).toEqual([])
    expect(missing).toEqual(["丙"])
  })
})

describe("deductJudgeRow（扣回法官分，只动积分不动场次）", () => {
  const rank = [
    [1, "甲", 5, 3, 2, "60.00%", 12],
    [2, "柴", 0, 0, 0, "0.00%", 3.5],
  ]

  it("按昵称定位，扣 0.5", () => {
    expect(svc.deductJudgeRow(rank, { name: "柴", score: 0.5 })).toEqual({ row: 3, score: 3 })
  })

  it("法官为空 / 分数为 0 / 找不到 → null", () => {
    expect(svc.deductJudgeRow(rank, null)).toBeNull()
    expect(svc.deductJudgeRow(rank, { name: "柴", score: 0 })).toBeNull()
    expect(svc.deductJudgeRow(rank, { name: "无此人", score: 0.5 })).toBeNull()
  })
})
