import { describe, it, expect, afterAll, beforeEach } from "bun:test"
import { __resetAudioActivityForTest } from "@/utils/audioActivity"
import { __resetSpeechForTest } from "@/utils/speech"
import { useGame } from "./useGame"
import { computeStepKeys } from "@/game/step-flow"

// 测试环境 window / speech mock（与 useGame.e2e.test.ts 一致）
;(globalThis as any).window = {
  speechSynthesis: { getVoices: () => [], speak: () => {}, cancel: () => {} },
}
;(globalThis as any).SpeechSynthesisUtterance = class {
  text = ""
  rate = 1
  pitch = 1
  volume = 1
  constructor(text: string) {
    this.text = text
  }
}

/** 通过真实 actions 建局：设板子→加人→确认→开局→分配角色→进入第一夜 */
function setupGame(game: ReturnType<typeof useGame>, board: string[]) {
  game.actions.setBoardRoles(board)
  for (let i = 1; i <= board.length; i++) game.actions.addPlayer(`P${i}`, i)
  game.actions.confirmPlayers()
  game.actions.startGame()
  const roles = game.refs.getBoardRoles(game.state)
  for (let i = 0; i < board.length; i++) game.actions.confirmRole(`P${i + 1}`, roles[i])
  game.actions.flowToggle()
}

describe("useGame × step-flow 集成（真实 actions → 当前步骤）", () => {
  let game: ReturnType<typeof useGame>

  beforeEach(() => {
    game = useGame()
    game.actions.clearAllData()
  })

  afterAll(() => {
    __resetSpeechForTest()
    __resetAudioActivityForTest()
  })

  it("12k 首夜：步骤序列基于板子角色（狼→预言家→女巫→白痴→骑士→猎人→警长）", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"])
    expect(game.state.phase).toBe("night")
    expect(game.state.round).toBe(1)
    expect(computeStepKeys(game.state)).toEqual([
      "wolf", "prophet", "witch", "idiotOpen", "knight", "hunterOpen", "jinghui",
    ])
  })

  it("9人标准板首夜：狼→预言家→女巫→猎人→警长", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    expect(computeStepKeys(game.state)).toEqual(["wolf", "prophet", "witch", "hunterOpen", "jinghui"])
  })

  it("标记 wolf 完成 → 首项推进到 prophet", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.state.uiDone = { ...game.state.uiDone, wolf: true }
    expect(computeStepKeys(game.state)[0]).toBe("prophet")
  })

  it("推进所有夜间步骤 + 警长 → ['dawn']", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.state.uiDone = { wolf: true, witch: true, prophet: true, hunterOpen: true, jinghui: true }
    expect(computeStepKeys(game.state)).toEqual(["dawn"])
  })

  it("进入白天：步骤为 [speech, vote, night]（首夜含 prophetReport）", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.wolfKill("P9") // 完成狼人刀人步骤
    game.actions.dawnSettle()
    expect(game.state.phase).toBe("day")
    expect(computeStepKeys(game.state)).toEqual(["prophetReport", "speech", "vote", "night"])
  })
})
