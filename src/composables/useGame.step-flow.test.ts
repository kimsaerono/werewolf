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

  it("局末提交荣誉：补算本轮分差并回写历史", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.setSimMode(true)
    game.state.winCamp = "god"
    game.state.winReason = "测试"
    game.state.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    game.actions.flowToggle() // 触发 settle：落盘历史 + 弹结算窗

    const rec = game.history.value.at(-1)!
    expect(game.history.value.length).toBe(1)
    expect(rec.synced).toBe(false)
    expect(rec.honorConfirmed).toBe(false)
    expect(rec.mvp).toBe("")

    const prophet = game.state.players.find((p) => p.role === "预言家")!
    const before = prophet.scoreTotal
    expect(game.actions.commitHonors(prophet.name, "", "")).toBeNull()
    expect(prophet.scoreRound).toBe(4)
    expect(prophet.scoreTotal).toBe(before + 1)
    expect(rec.honorConfirmed).toBe(true)
    expect(rec.mvp).toBe(prophet.name)
    expect(rec.players.find((p) => p.name === prophet.name)!.scoreTotal).toBe(before + 1)
    expect(rec.players.find((p) => p.name === prophet.name)!.scoreDetail).toContain("MVP+1")
  })

  it("荣誉不能重复选同一名玩家", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.setSimMode(true)
    game.state.winCamp = "god"
    game.state.winReason = "测试"
    game.state.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    game.actions.flowToggle()

    expect(game.actions.commitHonors("P4", "P4", "")).toContain("不能选同一名玩家")
    expect(game.history.value.at(-1)!.mvp).toBe("")
  })

  it("重复提交不重复加分，下一局荣誉已重置", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.setSimMode(true)
    game.state.winCamp = "god"
    game.state.winReason = "测试"
    game.state.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    game.actions.flowToggle()
    const prophet = game.state.players.find((p) => p.role === "预言家")!

    expect(game.actions.commitHonors(prophet.name, "", "")).toBeNull()
    const total = prophet.scoreTotal
    expect(game.actions.commitHonors(prophet.name, "", "")).toBeNull()
    expect(prophet.scoreTotal).toBe(total)

    game.actions.startNextGame()
    expect(game.state.mvp).toBe("")
    expect(game.state.svp).toBe("")
    expect(game.state.beiguo).toBe("")
    expect(game.history.value.length).toBe(1)
    expect(game.history.value[0].mvp).toBe(prophet.name)
  })

  it("刷新后恢复未确认的结算弹窗，确认后不再恢复", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.setSimMode(true)
    game.state.winCamp = "god"
    game.state.winReason = "测试"
    game.state.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    game.actions.flowToggle()
    expect(game.winNoticeOpen.value).toBe(true)

    // 模拟刷新：内存里的弹窗丢失，但历史记录仍是「未确认」
    game.winNoticeOpen.value = false
    expect(game.winNoticeOpen.value).toBe(false)
    game.actions.restorePendingSettlement()
    expect(game.winNoticeOpen.value).toBe(true)
    expect(game.winNotice.value?.text).toBe("好人胜利")

    // 确认后刷新不再弹
    expect(game.actions.commitHonors("", "", "")).toBeNull()
    game.winNoticeOpen.value = false
    game.actions.restorePendingSettlement()
    expect(game.winNoticeOpen.value).toBe(false)
  })
})
