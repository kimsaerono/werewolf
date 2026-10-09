import { describe, expect, it } from "bun:test"
import { quarterBefore, quarterLater, rankHasHistory } from "./seasonArchive"

const sa = require("../deploy/werewolf-sync/season-archive.cjs") as {
  quarterBefore: typeof quarterBefore
  quarterLater: typeof quarterLater
  rankHasHistory: typeof rankHasHistory
}

describe("quarterBefore", () => {
  it("跨年与年内回退", () => {
    expect(quarterBefore("2026-Q4")).toBe("2026-Q3")
    expect(quarterBefore("2027-Q1")).toBe("2026-Q4")
    expect(quarterBefore("2026-Q1")).toBe("2025-Q4")
    expect(quarterBefore("bad")).toBe("")
  })

  it("cjs 与 TS 一致", () => {
    for (const k of ["2026-Q4", "2027-Q1", "bad"]) {
      expect(sa.quarterBefore(k)).toBe(quarterBefore(k))
      expect(sa.quarterLater("2026-Q4", "2026-Q3")).toBe(quarterLater("2026-Q4", "2026-Q3"))
    }
  })
})

describe("rankHasHistory", () => {
  const header = ["排名", "玩家昵称", "总场次", "胜场", "负场", "胜率", "总积分"]

  it("空表 / 仅表头 → false", () => {
    expect(rankHasHistory([])).toBe(false)
    expect(rankHasHistory([header])).toBe(false)
    expect(rankHasHistory([header, [1, "甲", 0, 0, 0, "0%", 0]])).toBe(false)
  })

  it("有场次或积分 → true；cjs 一致", () => {
    const withGames = [header, [1, "甲", 1, 1, 0, "100%", 2]]
    const judgeOnly = [header, [1, "乙", 0, 0, 0, "0%", 0.5]]
    expect(rankHasHistory(withGames)).toBe(true)
    expect(rankHasHistory(judgeOnly)).toBe(true)
    expect(sa.rankHasHistory(withGames)).toBe(true)
    expect(sa.rankHasHistory(judgeOnly)).toBe(true)
    expect(sa.rankHasHistory([header, [1, "甲", 0, 0, 0, "0%", 0]])).toBe(false)
  })
})
