import { describe, it, expect } from "bun:test"
import { buildSyncPayload } from "./feishuSync"
import type { GameRecord } from "@/composables/useGame"

function rec(winner: string, players: { name: string; role: string; detail: string[] }[], lovers: string[] = []): GameRecord {
  return {
    title: "第1局",
    time: "2026-08-14",
    board: "12q",
    winner,
    reason: "测试",
    judge: "",
    judgeScore: 0,
    players: players.map((p, i) => ({
      no: i + 1,
      name: p.name,
      role: p.role,
      alive: true,
      scoreRound: 0,
      scoreTotal: 0,
      star: "-",
      scoreDetail: p.detail,
    })),
    log: [],
    lovers,
  }
}

describe("buildSyncPayload 胜负/拆分解", () => {
  it("狼人胜利：狼胜、好人负", () => {
    const r = rec("狼人胜利", [
      { name: "狼A", role: "狼人", detail: ["狼人胜利+3"] },
      { name: "好B", role: "平民", detail: [] },
    ])
    const p = buildSyncPayload(r).players
    expect(p.find((x) => x.name === "狼A")!.win).toBe(true)
    expect(p.find((x) => x.name === "好B")!.win).toBe(false)
    expect(p.find((x) => x.name === "狼A")!.base).toBe(3)
  })

  it("好人胜利（神职/平民文案）：神职胜、平民胜、狼负", () => {
    const r = rec("神职胜利", [
      { name: "神A", role: "预言家", detail: ["神职胜利+3"] },
      { name: "民B", role: "平民", detail: ["平民胜利+2"] },
      { name: "狼C", role: "狼人", detail: [] },
    ])
    const p = buildSyncPayload(r).players
    expect(p.find((x) => x.name === "神A")!.win).toBe(true)
    expect(p.find((x) => x.name === "民B")!.win).toBe(true)
    expect(p.find((x) => x.name === "狼C")!.win).toBe(false)
    expect(p.find((x) => x.name === "民B")!.base).toBe(2)
  })

  it("第三方胜利：丘比特+人狼恋情侣都算胜，单身狼算负", () => {
    const r = rec("第三方胜利", [
      { name: "丘比特", role: "丘比特", detail: ["第三方胜利+3"] },
      { name: "狼恋人", role: "狼人", detail: ["第三方胜利+3"] },
      { name: "民恋人", role: "平民", detail: ["第三方胜利+3"] },
      { name: "单身狼", role: "狼人", detail: [] },
    ], ["狼恋人", "民恋人"])
    const p = buildSyncPayload(r).players
    expect(p.find((x) => x.name === "丘比特")!.win).toBe(true)
    expect(p.find((x) => x.name === "狼恋人")!.win).toBe(true)
    expect(p.find((x) => x.name === "民恋人")!.win).toBe(true)
    expect(p.find((x) => x.name === "单身狼")!.win).toBe(false)
  })

  it("技能分与基础分拆分：守卫守中+0.5 归技能分", () => {
    const r = rec("神职胜利", [
      { name: "守卫", role: "守卫", detail: ["神职胜利+3", "守中+0.5"] },
    ])
    const p = buildSyncPayload(r).players[0]
    expect(p.base).toBe(3)
    expect(p.skill).toBe(0.5)
    expect(p.vote).toBe(0)
  })
})
