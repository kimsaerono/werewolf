import { describe, it, expect } from "bun:test"
import { getActiveNightStepKeys, type NightStepCtx } from "./nightActionRegistry"

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

describe("nightActionRegistry · 夜间步骤顺序与历史一致", () => {
  it("9人标准板（3狼+预女猎+3民）首夜：狼→女巫→预言家→猎人→警长", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"],
      }),
    )
    expect(keys).toEqual(["wolf", "witch", "prophet", "hunterOpen"])
  })

  it("含守卫：守卫在狼人之前", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "狼人", "守卫", "预言家", "女巫", "猎人", "平民", "平民"],
      }),
    )
    expect(keys).toEqual(["guard", "wolf", "witch", "prophet", "hunterOpen"])
  })

  it("12k（含骑士/白痴）：白痴、骑士在女巫预言家之后、猎人之前；首夜生效", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"],
      }),
    )
    expect(keys).toEqual(["wolf", "witch", "prophet", "idiotOpen", "knight", "hunterOpen"])
  })

  it("含丘比特：丘比特→情侣认亲 最前", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "狼人", "狼人", "丘比特", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"],
        lovers: ["P1", "P2"],
      }),
    )
    expect(keys).toEqual(["cupid", "loversMeet", "wolf", "witch", "prophet", "hunterOpen"])
  })

  it("第二夜：首夜限定步骤(丘比特/情侣/白痴/骑士)不再出现", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        round: 2,
        boardRoles: ["狼人", "狼人", "丘比特", "预言家", "女巫", "骑士", "白痴", "平民"],
      }),
    )
    expect(keys).toEqual(["wolf", "witch", "prophet", "hunterOpen"].filter((k) => k !== "hunterOpen"))
    expect(keys).not.toContain("idiotOpen")
    expect(keys).not.toContain("knight")
  })

  it("守卫/女巫已行动(nightSteps)：对应步骤移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "守卫", "女巫", "预言家", "猎人", "平民"],
        nightSteps: { guard: true, witch: true },
      }),
    )
    expect(keys).toEqual(["wolf", "prophet", "hunterOpen"])
  })

  it("猎人已出局：猎人睁眼步骤移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "预言家", "女巫", "猎人", "平民"],
        hunterExists: true,
        hunterAlive: false,
      }),
    )
    expect(keys).not.toContain("hunterOpen")
  })

  it("完成(uiDone)的步骤移除", () => {
    const keys = getActiveNightStepKeys(
      ctx({
        boardRoles: ["狼人", "预言家", "女巫", "猎人", "平民"],
        uiDone: { wolf: true, prophet: true },
      }),
    )
    expect(keys).toEqual(["witch", "hunterOpen"])
  })

  it("狼人全确认且无存活狼：狼人步骤移除", () => {
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
