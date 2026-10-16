import { describe, it, expect } from "bun:test"
import { defaultState, newPlayer, type GameState } from "./logic"
import { computeStepKeys, getActiveNightStepKeys, type NightStepCtx } from "./step-flow"

/**
 * 步骤编排回归测试：锁定夜间/白天「当前步骤」的顺序与启用条件。
 * 这些是 UI 流程的核心逻辑，改动必须走这层护栏。
 */

// ---------- computeStepKeys 全阶段 ----------

function build(roles: string[], over: Partial<GameState> = {}): GameState {
  const s = defaultState()
  s.boardRoles = roles
  s.board = "custom"
  s.players = roles.map((r, i) => {
    const p = newPlayer("P" + (i + 1))
    p.role = r
    return p
  })
  s.phase = "night"
  s.round = 1
  Object.assign(s, over)
  return s
}

describe("computeStepKeys · 阶段总览", () => {
  it("idle → ['idle']", () => {
    const s = build(["狼人", "平民"])
    s.phase = "idle"
    expect(computeStepKeys(s)).toEqual(["idle"])
  })

  it("finished → ['end']", () => {
    const s = build(["狼人", "平民"])
    s.finished = true
    expect(computeStepKeys(s)).toEqual(["end"])
  })

  it("夜晚 → 夜间步骤 + 警长 + 天亮", () => {
    const s = build(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    expect(computeStepKeys(s)).toEqual(["wolf", "witch", "prophet", "hunterOpen", "jinghui"])
  })

  it("白天 → [speech, vote, night]（首夜含 prophetReport）", () => {
    const s = build(["狼人", "预言家", "平民", "平民"], { phase: "day", round: 1 })
    expect(computeStepKeys(s)).toEqual(["prophetReport", "speech", "vote", "night"])
  })

  it("白天（非首夜）→ [speech, vote, night]", () => {
    const s = build(["狼人", "预言家", "平民", "平民"], { phase: "day", round: 2 })
    expect(computeStepKeys(s)).toEqual(["speech", "vote", "night"])
  })

  it("白天 skipVote + 狼王待开枪 → ['wolfkingShot']", () => {
    const s = build(["狼人", "预言家", "平民"], { phase: "day", skipVote: true, wolfKingShotPending: true })
    expect(computeStepKeys(s)).toEqual(["wolfkingShot"])
  })

  it("白天 skipVote + 猎人待开枪 → ['hunter']", () => {
    const s = build(["狼人", "预言家", "平民"], { phase: "day", skipVote: true, hunterShotPending: true })
    expect(computeStepKeys(s)).toEqual(["hunter"])
  })

  it("白天 skipVote 无待枪 → ['night']", () => {
    const s = build(["狼人", "预言家", "平民"], { phase: "day", skipVote: true })
    expect(computeStepKeys(s)).toEqual(["night"])
  })

  it("白天 待开枪优先级高于发言/投票", () => {
    const s = build(["狼人", "猎人", "平民"], { phase: "day", hunterShotPending: true })
    expect(computeStepKeys(s)[0]).toBe("hunter")
  })
})

describe("computeStepKeys · 夜间顺序与条件", () => {
  it("9人标准板首夜：狼→女巫→预言家→猎人→警长", () => {
    const s = build(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    expect(computeStepKeys(s)).toEqual(["wolf", "witch", "prophet", "hunterOpen", "jinghui"])
  })

  it("含守卫：守卫在狼人之前", () => {
    const s = build(["狼人", "守卫", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    expect(computeStepKeys(s)).toEqual(["guard", "wolf", "witch", "prophet", "hunterOpen", "jinghui"])
  })

  it("含丘比特：丘比特→情侣认亲 最前", () => {
    const s = build(["狼人", "狼人", "狼人", "丘比特", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"])
    s.lovers = ["P1", "P2"]
    expect(computeStepKeys(s)).toEqual(["cupid", "loversMeet", "wolf", "witch", "prophet", "hunterOpen", "jinghui"])
  })

  it("12k（骑士/白痴）：白痴、骑士在预言家之后、猎人之前（首夜）", () => {
    const s = build(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"])
    expect(computeStepKeys(s)).toEqual(["wolf", "witch", "prophet", "idiotOpen", "knight", "hunterOpen", "jinghui"])
  })

  it("第二夜：首夜限定步骤（丘比特/情侣/白痴/骑士）不再出现", () => {
    const s = build(["狼人", "守卫", "丘比特", "预言家", "女巫", "骑士", "白痴", "猎人", "平民"], { round: 2 })
    s.lovers = ["P1", "P2"]
    const keys = computeStepKeys(s)
    expect(keys).not.toContain("idiotOpen")
    expect(keys).not.toContain("knight")
    expect(keys).not.toContain("cupid")
    expect(keys).not.toContain("loversMeet")
    expect(keys).not.toContain("jinghui")
    expect(keys).toEqual(["guard", "wolf", "witch", "prophet", "hunterOpen"])
  })

  it("夜刀完成(nightSteps.wolf)且无存活狼：狼人步骤移除，全部完成则天亮", () => {
    const s = build(["狼人", "预言家", "平民"], { round: 2 })
    s.nightSteps = { wolf: true }
    s.players[0].alive = false // 狼人出局
    s.uiDone = { prophet: true }
    expect(computeStepKeys(s)).toEqual(["dawn"])
  })

  it("守卫/女巫已行动：对应步骤移除", () => {
    const s = build(["狼人", "守卫", "女巫", "预言家", "猎人", "平民"], { round: 2 })
    s.nightSteps = { guard: true, witch: true }
    expect(computeStepKeys(s)).toEqual(["wolf", "prophet", "hunterOpen"])
  })

  it("猎人已出局：猎人睁眼步骤移除", () => {
    const s = build(["狼人", "预言家", "女巫", "猎人", "平民"], { round: 2 })
    const h = s.players.find((p) => p.role === "猎人")!
    h.alive = false
    expect(computeStepKeys(s)).not.toContain("hunterOpen")
  })

  it("uiDone 的步骤移除（首夜）", () => {
    const s = build(["狼人", "预言家", "女巫", "猎人", "平民"])
    s.uiDone = { wolf: true, prophet: true }
    expect(computeStepKeys(s)).toEqual(["witch", "hunterOpen", "jinghui"])
  })

  it("首夜全部步骤 + 警长完成 → ['dawn']", () => {
    const s = build(["狼人", "预言家", "平民"])
    s.uiDone = { wolf: true, prophet: true, jinghui: true }
    expect(computeStepKeys(s)).toEqual(["dawn"])
  })
})

// ---------- getActiveNightStepKeys 直接单测（保留原护栏） ----------

function ctx(over: Partial<NightStepCtx> = {}): NightStepCtx {
  return {
    boardRoles: [],
    uiDone: {},
    nightSteps: {},
    round: 1,
    lovers: [],
    isWolfRole: (r) => r === "狼人" || r === "狼王" || r === "白狼王",
    players: [],
    hunterExists: false,
    hunterAlive: false,
    ...over,
  }
}

describe("getActiveNightStepKeys · 顺序与条件与历史一致", () => {
  it("9人标准板：狼→女巫→预言家→猎人", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"] }),
    )
    expect(keys).toEqual(["wolf", "witch", "prophet", "hunterOpen"])
  })

  it("守卫在狼人之前", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "狼人", "守卫", "预言家", "女巫", "猎人", "平民", "平民"] }),
    )
    expect(keys).toEqual(["guard", "wolf", "witch", "prophet", "hunterOpen"])
  })

  it("白痴、骑士在预言家之后、猎人之前（首夜）", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"] }),
    )
    expect(keys).toEqual(["wolf", "witch", "prophet", "idiotOpen", "knight", "hunterOpen"])
  })

  it("丘比特→情侣认亲 最前", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "狼人", "狼人", "丘比特", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"],
        lovers: ["P1", "P2"],
      }),
    )
    expect(keys).toEqual(["cupid", "loversMeet", "wolf", "witch", "prophet", "hunterOpen"])
  })

  it("第二夜不再出现首夜限定步骤", () => {
    const keys = getActiveNightStepKeys(
      ctx({ round: 2, boardRoles: ["狼人", "狼人", "丘比特", "预言家", "女巫", "骑士", "白痴", "平民"] }),
    )
    expect(keys).not.toContain("idiotOpen")
    expect(keys).not.toContain("knight")
    expect(keys).not.toContain("cupid")
  })

  it("守卫/女巫已行动移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "守卫", "女巫", "预言家", "猎人", "平民"], nightSteps: { guard: true, witch: true } }),
    )
    expect(keys).toEqual(["wolf", "prophet", "hunterOpen"])
  })

  it("猎人已出局移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "预言家", "女巫", "猎人", "平民"], hunterExists: true, hunterAlive: false }),
    )
    expect(keys).not.toContain("hunterOpen")
  })

  it("uiDone 步骤移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({ boardRoles: ["狼人", "预言家", "女巫", "猎人", "平民"], uiDone: { wolf: true, prophet: true } }),
    )
    expect(keys).toEqual(["witch", "hunterOpen"])
  })

  it("狼人全确认且无存活狼 → 狼人步骤移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "预言家", "女巫", "平民", "平民"],
        players: [
          { role: "狼人", alive: false },
          { role: "预言家", alive: true },
          { role: "女巫", alive: true },
        ],
      }),
    )
    expect(keys).not.toContain("wolf")
  })
})
