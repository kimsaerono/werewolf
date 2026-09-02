import { describe, it, expect, beforeEach } from "bun:test"
import { useGame } from "./useGame"

// Mock window for test environment
;(globalThis as any).window = {
  speechSynthesis: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
  },
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

/** E2E 测试：通过 useGame actions 模拟完整游戏流程 */

function setupGame(game: ReturnType<typeof useGame>, board: string[]) {
  game.actions.setBoardRoles(board)
  for (let i = 1; i <= board.length; i++) {
    game.actions.addPlayer(`P${i}`, i)
  }
  game.actions.confirmPlayers()
  game.actions.startGame()
  const roles = game.refs.getBoardRoles(game.state)
  for (let i = 0; i < board.length; i++) {
    game.actions.confirmRole(`P${i + 1}`, roles[i])
  }
  game.actions.flowToggle() // 进入第一夜
}

function g(game: ReturnType<typeof useGame>, name: string) {
  return game.state.players.find((p) => p.name === name)!
}

describe("E2E 完整游戏流程", () => {
  let game: ReturnType<typeof useGame>

  beforeEach(() => {
    game = useGame()
    game.actions.clearAllData()
  })

  it("标准12人局：狼人屠神胜利", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])
    game.actions.setJudge("法官A")
    game.actions.setWinMode("edge")

    expect(game.state.phase).toBe("night")
    expect(game.state.round).toBe(1)

    // 第一夜：狼刀预言家(P5)，守卫守女巫(P6)，女巫救预言家
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(game.state.phase).toBe("day")
    expect(g(game, "P5").alive).toBe(true) // 被救了

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)
    expect(g(game, "P1").alive).toBe(false)

    // 第二夜：狼刀女巫(P6)
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P7", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)

    // 第二天：放逐狼人P2
    game.actions.finishVote("P2", false)
    expect(g(game, "P2").alive).toBe(false)

    // 第三夜：狼刀猎人(P7)
    game.actions.flowToggle()
    game.actions.wolfKill("P7")
    game.actions.guardDo("P8", false)
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)

    // 猎人开枪带走P3
    game.actions.hunterShoot("P3")
    expect(g(game, "P3").alive).toBe(false)

    // 第三天：放逐狼人P4（最后一狼）
    game.actions.finishVote("P4", false)
    expect(g(game, "P4").alive).toBe(false)

    // 检查胜负：狼全灭，好人胜利
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
    expect(game.state.judgeScores["法官A"]).toBe(0.5)
    expect(game.history.value.length).toBe(1)
    expect(game.history.value[0].winner).toBe("好人胜利")
  })

  it("标准12人局：狼人屠民胜利", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])
    game.actions.setJudge("法官B")

    // 第一夜：狼刀平民P9，女巫不救
    game.actions.wolfKill("P9")
    game.actions.guardDo("P5", false)
    // 女巫不救，浪费解药
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P9").alive).toBe(false)

    // 第一天：放逐平民P10
    game.actions.finishVote("P10", false)

    // 第二夜：狼刀平民P11，女巫仍不救
    game.actions.flowToggle()
    game.actions.wolfKill("P11")
    game.actions.guardDo("P5", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P11").alive).toBe(false)

    // 第三天：放逐平民P12
    game.actions.finishVote("P12", false)

    // 平民全灭，狼人胜利（屠边）
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("wolf")
  })

  it("白痴局：白痴翻牌后不能被放逐", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "白痴", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天：放逐白痴P8，翻牌免死
    game.actions.finishVote("P8", true)
    expect(g(game, "P8").alive).toBe(true)
    expect(g(game, "P8").mark.idiotFlipped).toBe(true)

    // 第二天：再次尝试放逐白痴，应该失败
    const err = game.actions.finishVote("P8", false)
    expect(err).toContain("已翻牌")
    expect(g(game, "P8").alive).toBe(true)
  })

  it("白狼王局：自爆带走关键角色", () => {
    setupGame(game, ["白狼王", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：平安夜（守卫守P6，女巫救P5）
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 白天：白狼王P1自爆带走预言家P5
    const err = game.actions.wolfKingBaoZha("P1", "P5")
    expect(err).toBeNull()
    expect(g(game, "P1").alive).toBe(false)
    expect(g(game, "P5").alive).toBe(false)
    expect(game.state.skipVote).toBe(true)

    // 直接进入夜晚
    game.actions.flowToggle()
    expect(game.state.phase).toBe("night")
    expect(game.state.round).toBe(2)

    // 第二夜：狼刀女巫P6
    game.actions.wolfKill("P6")
    game.actions.guardDo("P7", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)
  })

  it("多局连续：状态正确重置", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])
    game.actions.setJudge("法官C")

    // 第一局：快速结束（狼刀预言家→放逐狼人→狼刀女巫→放逐狼人→狼刀猎人→猎人开枪→放逐最后一狼）
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()
    game.actions.finishVote("P1", false)

    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P7", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()
    game.actions.finishVote("P2", false)

    game.actions.flowToggle()
    game.actions.wolfKill("P7")
    game.actions.guardDo("P8", false)
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()
    game.actions.hunterShoot("P3")
    game.actions.finishVote("P4", false)

    // 第一局结束，好人胜利
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
    expect(game.state.judgeScores["法官C"]).toBe(0.5)

    // 第二局
    game.actions.startNextGame()
    expect(game.state.finished).toBe(false)
    expect(game.state.winCamp).toBeNull()
    expect(game.state.phase).toBe("idle")
    expect(game.state.round).toBe(0)
    expect(game.state.players.length).toBe(12)
    expect(game.state.players.every((p: any) => !p.role)).toBe(true)
    expect(game.state.players.every((p: any) => p.alive)).toBe(true)

    // 重新分配角色
    const roles = game.refs.getBoardRoles(game.state)
    for (let i = 0; i < 12; i++) {
      game.actions.confirmRole(`P${i + 1}`, roles[i])
    }
    game.actions.flowToggle()
    expect(game.state.phase).toBe("night")
    expect(game.state.round).toBe(1)

    // 检查法官积分累计
    expect(game.state.judgeScores["法官C"]).toBe(0.5)
  })

  it("猎人被毒不能开枪", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀猎人P7，女巫毒猎人P7
    game.actions.wolfKill("P7")
    game.actions.guardDo("P5", false)
    game.actions.witchPoison("P7")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(false)
    expect(g(game, "P7").mark.hunterIsPoisoned).toBe(true)
  })

  it("同守同救：目标死亡", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀平民P9，守卫守P9，女巫救P9
    game.actions.wolfKill("P9")
    game.actions.guardDo("P9", true) // 同守同救
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P9").alive).toBe(false) // 同守同救死
  })

  it("骑士决斗：戳中狼人狼死", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "平民", "平民", "平民", "平民"])

    // 第一夜：平安夜
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天：骑士决斗狼人P1
    game.actions.knightDuel("P1")
    expect(g(game, "P1").alive).toBe(false)
    expect(g(game, "P8").alive).toBe(true)

    // 再次决斗应该失败（每局一次）
    const err = game.actions.knightDuel("P2")
    expect(err).toContain("已用过")
  })

  it("骑士决斗：戳错好人骑士死", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "平民", "平民", "平民", "平民"])

    // 第一夜：平安夜
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天：骑士决斗好人P9
    game.actions.knightDuel("P9")
    expect(g(game, "P9").alive).toBe(true)
    expect(g(game, "P8").alive).toBe(false)
  })

  it("狼人自爆：跳过白天直接进入黑夜", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：平安夜
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 白天：狼人P1自爆
    const roundBefore = game.state.round
    game.actions.wolfBaoZha("P1")
    expect(g(game, "P1").alive).toBe(false)
    expect(game.state.skipVote).toBe(true)

    // 直接进入夜晚
    game.actions.flowToggle()
    expect(game.state.phase).toBe("night")
    expect(game.state.round).toBe(roundBefore + 1)
  })

  it("6人局：狼人快速屠城胜利", () => {
    setupGame(game, ["狼人", "狼人", "预言家", "女巫", "平民", "平民"])
    game.actions.setWinMode("city")

    // 第一夜：狼刀平民P5，女巫不救（跳过witchSave）
    game.actions.wolfKill("P5")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(false)

    // 第一天：放逐平民P6
    game.actions.finishVote("P6", false)

    // 第二夜：狼刀预言家P3
    game.actions.flowToggle()
    game.actions.wolfKill("P3")
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P3").alive).toBe(false)

    // 第三天：放逐女巫P4
    game.actions.finishVote("P4", false)

    // 神全灭+民全灭，屠城狼胜
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("wolf")
  })

  it("7人局：好人胜利", () => {
    setupGame(game, ["狼人", "狼人", "预言家", "猎人", "平民", "平民", "平民"])

    // 第一夜：狼刀猎人P4，女巫不存在
    game.actions.wolfKill("P4")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P4").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)

    // 猎人开枪带走狼人P1
    game.actions.hunterShoot("P1")

    // 第一天：放逐狼人P2
    game.actions.finishVote("P2", false)

    // 狼全灭，好人胜利
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("8人局（带守卫）：同守同救死", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民"])

    // 第一夜：狼刀预言家P4，守卫守P4，女巫救P4
    game.actions.wolfKill("P4")
    game.actions.guardDo("P4", true)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P4").alive).toBe(false) // 同守同救死

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀女巫P5
    game.actions.flowToggle()
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(false)

    // 第二天：放逐狼人P2
    game.actions.finishVote("P2", false)

    // 第三夜：狼刀猎人P6
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P8", false)
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)
    game.actions.hunterShoot("P3")

    // 狼全灭
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("9人局：狼人屠民胜利", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"])
    game.actions.setWinMode("edge")

    // 第一夜：狼刀平民P7，女巫不救（跳过witchSave）
    game.actions.wolfKill("P7")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false)

    // 第一天：放逐平民P8
    game.actions.finishVote("P8", false)

    // 第二夜：狼刀平民P9
    game.actions.flowToggle()
    game.actions.wolfKill("P9")
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P9").alive).toBe(false)

    // 平民全灭，屠边狼胜
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("wolf")
  })

  it("10人局：预言家查验流程", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀女巫P5，女巫自救
    game.actions.wolfKill("P5")
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(true) // 女巫自救成功

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀猎人P6，预言家查P2（狼人）
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)
    game.actions.hunterShoot("P2")

    // 还有P3一只狼，游戏继续
    expect(game.state.finished).toBe(false)

    // 第二天：放逐狼人P3
    game.actions.finishVote("P3", false)

    // 狼全灭
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("11人局：完整多轮流程", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P4，女巫救
    game.actions.wolfKill("P4")
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P4").alive).toBe(true)

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀女巫P5，女巫已用解药不能自救
    game.actions.flowToggle()
    game.actions.wolfKill("P5")
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(false)

    // 第二天：放逐狼人P2
    game.actions.finishVote("P2", false)

    // 第三夜：狼刀猎人P6
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)
    game.actions.hunterShoot("P3")

    // 狼全灭
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("12人骑士板子：骑士戳中狼人", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"])

    // 第一夜：平安夜
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天：骑士决斗狼人P1
    game.actions.knightDuel("P1")
    expect(g(game, "P1").alive).toBe(false)
    expect(g(game, "P7").alive).toBe(true)

    // 第二天：放逐狼人P2
    game.actions.finishVote("P2", false)

    // 第三夜：狼刀女巫P6
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P8", false)
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)

    // 第三天：放逐狼人P3
    game.actions.finishVote("P3", false)

    // 狼全灭
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("13人局：白痴翻牌后不能被放逐", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "白痴", "平民", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P5，女巫救
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(true)

    // 第一天：放逐白痴P8，翻牌免死
    game.actions.finishVote("P8", true)
    expect(g(game, "P8").alive).toBe(true)
    expect(g(game, "P8").mark.idiotFlipped).toBe(true)

    // 第二天：再次尝试放逐白痴，应该失败
    const err = game.actions.finishVote("P8", false)
    expect(err).toContain("已翻牌")
    expect(g(game, "P8").alive).toBe(true)

    // 继续游戏：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀女巫P6
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P7", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false)

    // 第三天：放逐狼人P2
    game.actions.finishVote("P2", false)

    // 第四夜：狼刀猎人P7
    game.actions.flowToggle()
    game.actions.wolfKill("P7")
    game.actions.guardDo("P9", false)
    game.actions.prophetCheck("P3")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true)
    game.actions.hunterShoot("P3")

    // 还有P4一只狼，游戏继续
    expect(game.state.finished).toBe(false)

    // 第四天：放逐最后一狼P4
    game.actions.finishVote("P4", false)

    // 狼全灭
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("女巫首夜被刀可自救", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀女巫P6，女巫自救
    game.actions.wolfKill("P6")
    game.actions.guardDo("P5", false)
    const err = game.actions.witchSave()
    expect(err).toBeNull() // 首夜可以自救
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(true) // 自救成功
  })

  it("女巫第二夜被刀不能自救", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀平民P9，女巫不救（保留解药到第二夜）
    game.actions.wolfKill("P9")
    game.actions.guardDo("P5", false)
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P9").alive).toBe(false) // 平民死亡

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀女巫P6，女巫有解药但不能自救（非首夜）
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    game.actions.guardDo("P7", false)
    const err = game.actions.witchSave()
    expect(err).toContain("首夜") // 不能自救
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(false) // 女巫死亡
  })

  it("狼人自刀骗解药：女巫救狼人", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼人自刀P1，女巫救P1
    game.actions.wolfKill("P1")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P1").alive).toBe(true) // 自刀被救
    expect(g(game, "P1").mark.wolfSelfKillCheat).toBe(true) // 标记自刀骗解药
  })

  it("女巫解药已用不能再救", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P5，女巫救
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(true)

    // 第一天：平安夜无事发生
    game.actions.finishVote("P1", false)

    // 第二夜：狼刀猎人P7，女巫解药已用完
    game.actions.flowToggle()
    game.actions.wolfKill("P7")
    game.actions.guardDo("P8", false)
    const err = game.actions.witchSave()
    expect(err).toContain("全部使用") // 解药已用完
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false) // 猎人被刀死
  })

  it("女巫同一晚不能同时使用解药和毒药", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P5，女巫用解药
    game.actions.wolfKill("P5")
    game.actions.guardDo("P6", false)
    game.actions.witchSave()

    // 同一晚尝试用毒药
    const err = game.actions.witchPoison("P1")
    expect(err).toContain("同一夜晚") // 不能同时使用两瓶药

    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P5").alive).toBe(true) // 解药生效
    expect(g(game, "P1").alive).toBe(true) // 毒药未使用
  })

  it("预言家查验狼人显示狼人", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P5，女巫救，预言家查P1（狼人）
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(game.state.prophetReport).toContain("狼人") // 查验结果为狼人
  })

  it("预言家查验好人显示好人", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀预言家P5，女巫救，预言家查P9（平民）
    game.actions.wolfKill("P5")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P9")
    game.actions.dawnSettle()

    expect(game.state.prophetReport).toContain("好人") // 查验结果为好人
  })

  it("猎人首夜被刀可开枪", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：狼刀猎人P7，女巫不救
    game.actions.wolfKill("P7")
    game.actions.guardDo("P5", false)
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    expect(g(game, "P7").alive).toBe(false)
    expect(game.state.hunterShotPending).toBe(true) // 猎人可开枪

    game.actions.hunterShoot("P1")
    expect(g(game, "P1").alive).toBe(false)
  })

  it("守卫连续两晚不能守同一人", () => {
    setupGame(game, ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民", "平民", "平民"])

    // 第一夜：守卫守P5
    game.actions.wolfKill("P6")
    game.actions.guardDo("P5", false)
    game.actions.witchSave()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天：放逐狼人P1
    game.actions.finishVote("P1", false)

    // 第二夜：守卫尝试再次守P5，应该失败
    game.actions.flowToggle()
    game.actions.wolfKill("P6")
    const err = game.actions.guardDo("P5", false)
    expect(err).toContain("连续") // 不能连续守同一人

    // 改守P6
    game.actions.guardDo("P6", false)
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()

    expect(g(game, "P6").alive).toBe(true) // 守中
  })
})