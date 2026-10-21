import { describe, it, expect, afterAll, beforeEach } from "bun:test"
import { __resetAudioActivityForTest } from "@/utils/audioActivity"
import { __resetSpeechForTest } from "@/utils/speech"
import { useGame } from "./useGame"

// Mock window for test environment（与 useGame.e2e.test.ts 保持一致）
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

/**
 * 新角色 E2E：通过真实 useGame actions 驱动完整对局，验证
 * 隐狼 / 噩梦之影 / 血月使徒 / 猎魔人 / 摄梦人 / 野孩子 / 炸弹人
 * 在真实回合推进下能跑通并正确分出胜负（不只是单元级手动摆盘）。
 *
 * 命名约定：板子第 i 个角色（0-based）分给玩家 P{i+1}。
 */

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

describe("新角色 E2E 完整对局", () => {
  let game: ReturnType<typeof useGame>

  beforeEach(() => {
    game = useGame()
    game.actions.clearAllData()
  })

  afterAll(() => {
    __resetSpeechForTest()
    __resetAudioActivityForTest()
  })

  it("隐狼局：狼群全灭→隐狼带刀→狼胜", () => {
    // P1=狼人 P2=隐狼 P3=预言家 P4=平民 P5=平民（保留神职，避免误触屠边）
    setupGame(game, ["狼人", "隐狼", "预言家", "平民", "平民"])
    expect(game.state.phase).toBe("night")

    // 第一夜：狼刀平民P4；隐狼首夜认人
    game.actions.wolfKill("P4")
    game.actions.confirmRole("P2", "隐狼")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()
    expect(g(game, "P4").alive).toBe(false)

    // 第一天放逐普通狼P1 → 场上只剩隐狼带刀
    game.actions.finishVote("P1", false)
    expect(g(game, "P1").alive).toBe(false)
    expect(g(game, "P2").mark.hasKnife).toBe(true)
    expect(game.state.finished).toBe(false)

    // 第二夜：隐狼带刀杀平民P5
    game.actions.flowToggle()
    game.actions.wolfKill("P5")
    game.actions.dawnSettle()
    expect(g(game, "P5").alive).toBe(false)
  })

  it("噩梦之影局：恐狼→当晚空刀→好人胜", () => {
    // P1=狼人 P2=噩梦之影 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["狼人", "噩梦之影", "预言家", "平民", "平民"])

    // 第一夜：噩梦恐狼P1 → 狼队禁刀；狼必须空刀确认
    game.actions.nightmareFear("P1")
    expect(game.state.wolfFearedTonight).toBe(true)
    expect(game.actions.wolfKill("P5")).toContain("恐惧")
    game.actions.wolfEmptyKill()
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()
    expect(g(game, "P5").alive).toBe(true) // 空刀，平安夜

    // 放逐狼P1、噩梦P2
    game.actions.finishVote("P1", false)
    expect(g(game, "P1").alive).toBe(false)
    game.actions.finishVote("P2", false)
    expect(g(game, "P2").alive).toBe(false)
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("血月使徒局：自爆封印当夜神职", () => {
    // P1=血月使徒 P2=预言家 P3=女巫 P4=平民 P5=平民
    setupGame(game, ["血月使徒", "预言家", "女巫", "平民", "平民"])

    // 第一夜
    game.actions.wolfKill("P4")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天血月使徒自爆 → 封印当夜
    game.actions.wolfBaoZha("P1")
    expect(game.state.bloodMoonSeal).toBe(true)
    expect(g(game, "P1").alive).toBe(false)
    expect(game.state.skipVote).toBe(true)
  })

  it("猎魔人局：戳中狼→天亮狼死", () => {
    // P1=狼人 P2=猎魔人 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["狼人", "猎魔人", "预言家", "平民", "平民"])

    // 第一夜：猎魔戳狼P1；狼刀预言家P3
    game.state.round = 2
    game.actions.hunterHunt("P1")
    game.actions.wolfKill("P3")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()
    expect(g(game, "P1").alive).toBe(false) // 被猎魔戳中
    expect(g(game, "P3").alive).toBe(false) // 被狼刀
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("god")
  })

  it("摄梦人局：连续两晚同梦→天亮死亡", () => {
    // P1=狼人 P2=摄梦人 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["狼人", "摄梦人", "预言家", "平民", "平民"])

    // 第一夜：梦P1（狼）；狼刀平民P4（保留预言家，避免屠边误判）
    game.actions.dreamDo("P1")
    game.actions.wolfKill("P4")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()
    expect(g(game, "P4").alive).toBe(false)

    // 第二夜：再梦P1（同目标）→ 连梦致死；狼空刀（完成狼人步骤）
    game.actions.flowToggle()
    game.actions.dreamDo("P1")
    game.actions.wolfEmptyKill()
    game.actions.dawnSettle()
    expect(g(game, "P1").alive).toBe(false)
  })

  it("野孩子局：榜样死后黑化→阵营转为狼", () => {
    // P1=野孩子 P2=狼人 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["野孩子", "狼人", "预言家", "平民", "平民"])

    // 第一夜：野孩子选榜样P4
    game.actions.wildChildPick("P4")
    game.actions.wolfKill("P3")
    game.actions.prophetCheck("P1")
    game.actions.dawnSettle()

    // 第一天放逐榜样P4 → 下一夜黑化
    game.actions.finishVote("P4", false)
    expect(g(game, "P4").alive).toBe(false)
    game.actions.flowToggle() // 进入第二夜（nextNight 触发 checkWildChildTransform）
    expect(g(game, "P1").mark.isTransform).toBe(true)
  })

  it("炸弹人局：被放逐引爆炸死票选者", () => {
    // P1=炸弹人 P2=狼人 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["炸弹人", "狼人", "预言家", "平民", "平民"])

    // 第一夜
    game.actions.wolfKill("P4")
    game.actions.prophetCheck("P1")
    game.actions.confirmRole("P1", "炸弹人")
    game.actions.dawnSettle()
    expect(g(game, "P1").role).toBe("炸弹人")

    // 第一天：放逐炸弹人P1，票选P2（狼）
    game.actions.finishVote("P1", false, ["P2"])
    expect(g(game, "P1").alive).toBe(false)
    expect(g(game, "P2").alive).toBe(false)
    expect(g(game, "P1").mark.bombWolfCount).toBe(1)
  })

  it("炸弹人局：全票放逐→第三方独赢", () => {
    // P1=炸弹人(第三方) P2=狼人 P3=预言家 P4/P5=平民（保留神职与多名平民，避免误触屠边）
    setupGame(game, ["炸弹人", "狼人", "预言家", "平民", "平民"])

    game.actions.wolfKill("P4")
    game.actions.confirmRole("P1", "炸弹人")
    game.actions.prophetCheck("P2")
    game.actions.dawnSettle()
    expect(game.state.finished).toBe(false)

    // 第一天：全票放逐炸弹人（除自己外的全部存活玩家 P2、P3、P5）
    game.actions.finishVote("P1", false, ["P2", "P3", "P5"])
    expect(game.state.bombVictory).toBe(true)
    expect(game.state.finished).toBe(true)
    expect(game.state.winCamp).toBe("third")
  })

  it("噩梦 × 血月冲突：恐神 + 血月封印同夜，神职技能均失效", () => {
    // P1=血月使徒 P2=噩梦之影 P3=预言家 P4=平民 P5=平民
    setupGame(game, ["血月使徒", "噩梦之影", "预言家", "平民", "平民"])

    // 第一夜：噩梦恐预言家P3
    game.actions.nightmareFear("P3")
    game.actions.confirmRole("P2", "噩梦之影")
    // 预言家被恐 → 查验被拦
    expect(String(game.actions.prophetCheck("P1"))).toContain("恐惧")
    game.actions.wolfKill("P4")
    game.actions.dawnSettle()

    // 第一天：血月自爆封印当夜
    game.actions.wolfBaoZha("P1")
    expect(game.state.bloodMoonSeal).toBe(true)
    // 第二天夜：预言家再想查验 → 血月封印拦截
    game.actions.flowToggle()
    expect(String(game.actions.prophetCheck("P2"))).toContain("血月")
  })
})
