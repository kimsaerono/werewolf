import { describe, it, expect, beforeEach } from "bun:test"
import { useGame } from "./useGame"
import { SYNC_ENABLED } from "@/api/feishuSync"
import type { GameRecord } from "./useGame"

function makeRec(opts: {
  sim?: boolean
  winner?: string
  players: { name: string; role?: string; round: number; total: number; detail?: string[] }[]
}): GameRecord {
  return {
    title: "真实·第1局 · 2026年11月6日",
    time: "2026/11/6 12:26:31",
    board: "9人标准板",
    boardFinal: "狼人×3 预言家×1 女巫×1 猎人×1 平民×3",
    winner: opts.winner ?? "好人胜利",
    reason: "所有狼人已出局，好人胜利",
    judge: "柴",
    judgeScore: 0.5,
    players: opts.players.map((p, i) => ({
      no: i + 1,
      name: p.name,
      role: p.role ?? "平民",
      alive: true,
      scoreRound: p.round,
      scoreTotal: p.total,
      star: "-",
      scoreDetail: p.detail ?? [],
    })),
    log: [],
    lovers: [],
    synced: false,
    sim: opts.sim ?? false,
    mvp: "",
    svp: "",
    beiguo: "",
    honorConfirmed: true,
  }
}

describe("correctRecord（修正历史对局的本地记账）", () => {
  let game: ReturnType<typeof useGame>

  beforeEach(() => {
    game = useGame()
    game.actions.clearAllData()
    game.state.simMode = false
  })

  it("改胜负/原因/荣誉；本轮分变化顺延到之后同模式记录，模拟局不动", () => {
    const a = makeRec({
      players: [
        { name: "柴秀彬", role: "狼人", round: 3, total: 3, detail: ["狼人胜利+3"] },
        { name: "甲", role: "平民", round: 0, total: 0 },
      ],
    })
    const b = makeRec({
      players: [
        { name: "柴秀彬", role: "狼人", round: 2, total: 5, detail: ["狼人胜利+2"] },
        { name: "甲", role: "平民", round: 3, total: 3, detail: ["平民胜利+2", "技能+1"] },
      ],
    })
    const sim = makeRec({
      sim: true,
      players: [
        { name: "柴秀彬", role: "狼人", round: 1, total: 10 },
        { name: "甲", role: "平民", round: 0, total: 0 },
      ],
    })
    game.history.value = [a, b, sim]
    const recA = game.history.value[0]

    const err = game.actions.correctRecord(recA, {
      winner: "狼人胜利",
      reason: "屠边：神职全灭",
      mvp: "柴秀彬",
      svp: "甲",
      beiguo: "",
      scores: [
        { name: "柴秀彬", scoreRound: 0 },
        { name: "甲", scoreRound: 0 },
      ],
    })

    expect(err).toBeNull()
    expect(recA.winner).toBe("狼人胜利")
    expect(recA.reason).toBe("屠边：神职全灭")
    expect(recA.mvp).toBe("柴秀彬")
    expect(recA.svp).toBe("甲")
    expect(recA.honorConfirmed).toBe(true)

    const caiA = recA.players.find((p) => p.name === "柴秀彬")!
    expect(caiA.scoreRound).toBe(0)
    expect(caiA.scoreTotal).toBe(0)
    // 明细重写为单条手动修正，保证同步端拆出的 base+skill 合计等于本轮分
    expect(caiA.scoreDetail).toEqual(["手动修正+0"])

    // 之后同模式记录：柴秀彬累计 -3（5 → 2）；甲本轮未变，累计不变
    expect(game.history.value[1].players.find((p) => p.name === "柴秀彬")!.scoreTotal).toBe(2)
    expect(game.history.value[1].players.find((p) => p.name === "甲")!.scoreTotal).toBe(3)

    // 模拟局不参与顺延
    expect(game.history.value[2].players.find((p) => p.name === "柴秀彬")!.scoreTotal).toBe(10)
  })

  it("正分修正：scoreTotal 顺延加，明细写成「手动修正+N」", () => {
    const a = makeRec({ players: [{ name: "柴秀彬", role: "狼人", round: 0, total: 0 }] })
    const b = makeRec({ players: [{ name: "柴秀彬", role: "平民", round: 0, total: 0 }] })
    game.history.value = [a, b]
    const recA = game.history.value[0]

    game.actions.correctRecord(recA, {
      winner: "狼人胜利",
      reason: "屠边：神职全灭",
      mvp: "",
      svp: "",
      beiguo: "",
      scores: [{ name: "柴秀彬", scoreRound: 4 }],
    })

    const caiA = recA.players.find((p) => p.name === "柴秀彬")!
    expect(caiA.scoreRound).toBe(4)
    expect(caiA.scoreTotal).toBe(4)
    expect(caiA.scoreDetail).toEqual(["手动修正+4"])
    expect(game.history.value[1].players.find((p) => p.name === "柴秀彬")!.scoreTotal).toBe(4)
  })

  it("对不存在的玩家名不报错、也不产生改动", () => {
    const a = makeRec({ players: [{ name: "柴秀彬", role: "狼人", round: 3, total: 3 }] })
    game.history.value = [a]
    const recA = game.history.value[0]
    const err = game.actions.correctRecord(recA, {
      winner: "好人胜利",
      reason: "所有狼人已出局，好人胜利",
      mvp: "",
      svp: "",
      beiguo: "",
      scores: [{ name: "查无此人", scoreRound: 9 }],
    })
    expect(err).toBeNull()
    expect(recA.players[0].scoreTotal).toBe(3)
  })
})

describe("editAndResync（同步未启用时的安全边界）", () => {
  let game: ReturnType<typeof useGame>

  beforeEach(() => {
    game = useGame()
    game.actions.clearAllData()
    game.state.simMode = false
  })

  it("已同步局：回滚失败则本地不改、synced 仍为 true", async () => {
    if (SYNC_ENABLED) return
    const a = makeRec({ winner: "好人胜利", players: [{ name: "柴秀彬", role: "狼人", round: 0, total: 0 }] })
    a.synced = true
    game.history.value = [a]
    const rec = game.history.value[0]

    const err = await game.actions.editAndResync(rec, {
      winner: "狼人胜利",
      reason: "屠边：神职全灭",
      mvp: "",
      svp: "",
      beiguo: "",
      scores: [{ name: "柴秀彬", scoreRound: 3 }],
    })

    expect(err).toContain("未启用飞书同步")
    expect(rec.winner).toBe("好人胜利")
    expect(rec.synced).toBe(true)
  })

  it("未同步局：同步失败但本地已改、synced=false，可稍后重试", async () => {
    if (SYNC_ENABLED) return
    const a = makeRec({ winner: "好人胜利", players: [{ name: "柴秀彬", role: "狼人", round: 0, total: 0 }] })
    game.history.value = [a]
    const rec = game.history.value[0]

    const err = await game.actions.editAndResync(rec, {
      winner: "狼人胜利",
      reason: "屠边：神职全灭",
      mvp: "",
      svp: "",
      beiguo: "",
      scores: [{ name: "柴秀彬", scoreRound: 3 }],
    })

    expect(err).toContain("未启用飞书同步")
    expect(rec.winner).toBe("狼人胜利")
    expect(rec.synced).toBe(false)
    expect(rec.players[0].scoreTotal).toBe(3)
  })
})
