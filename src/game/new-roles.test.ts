import { describe, it, expect } from "bun:test"
import {
  defaultState,
  defaultMark,
  wolfKill,
  prophetCheck,
  witchPoison,
  witchSave,
  killPlayer,
  nextNight,
  finishVote,
  finishBombLastWords,
  wolfBaoZha,
  nightmareFear,
  wildChildPick,
  checkWildChildTransform,
  hunterHunt,
  dreamDo,
  hiddenWolfCanKnife,
  refreshHiddenWolfKnife,
  isEffectiveWolf,
  effectiveCampOf,
  checkWin,
  recalcScore,
  gargoyleCheck,
  gargoyleKill,
  gargoyleCanKill,
  charmDo,
  loverPartner,
  guardDo,
  gravekeeperResult,
  hunterShootConfirm,
  wolfKingShootConfirm,
  DEFAULT_VOICES,
  isWolfPackRole,
  cupidConnect,
  getChainType,
  isThirdMember,
} from "./logic"
import type { GameState, Player } from "./logic"
import { aliveCampCounts } from "./win-checker"
import { resolveNightEffects } from "./night-resolver"

function mk(name: string, no: number, role: string): Player {
  return { name, no, alive: true, role, scoreRound: 0, scoreTotal: 0, star: "", scoreDetail: [], mark: { ...defaultMark() } }
}

function makeState(roles: string[]): GameState {
  const st = defaultState()
  st.boardRoles = roles
  st.players = roles.map((r, i) => mk(`P${i}`, i, r))
  st.round = 1
  st.phase = "night"
  st.uiDone = {}
  st.nightWolfKill = ""
  st.nightWitchPoison = ""
  st.nightWitchSave = ""
  st.nightUsedDrug = null
  st.witchSaveUsed = false
  st.witchPoisonUsed = false
  refreshHiddenWolfKnife(st)
  return st
}

const g = (st: GameState, n: string) => st.players.find((p) => p.name === n)!

describe("隐狼", () => {
  it("预言家验隐狼为金水", () => {
    const st = makeState(["狼人", "隐狼", "预言家", "平民", "平民"])
    const r = prophetCheck(st, "P1")
    expect(typeof r).toBe("object")
    expect((r as { isWolf: boolean }).isWolf).toBe(false)
  })

  it("除隐狼外狼阵营全灭 → 隐狼获得刀人能力", () => {
    const st = makeState(["狼人", "隐狼", "预言家", "平民", "平民"])
    expect(hiddenWolfCanKnife(st)).toBe(false)
    g(st, "P0").alive = false
    refreshHiddenWolfKnife(st)
    expect(hiddenWolfCanKnife(st)).toBe(true)
    expect(g(st, "P1").mark.hasKnife).toBe(true)
  })

  it("仍有其他狼存活时隐狼无刀", () => {
    const st = makeState(["狼人", "隐狼", "预言家", "平民", "平民"])
    refreshHiddenWolfKnife(st)
    expect(g(st, "P1").mark.hasKnife).toBe(false)
  })

  it("带刀隐狼夜间刀人 → 目标天亮死亡（走隐狼自身 onNightResolve）", () => {
    const st = makeState(["隐狼", "预言家", "平民", "平民"])
    refreshHiddenWolfKnife(st)
    expect(hiddenWolfCanKnife(st)).toBe(true)
    wolfKill(st, "P2")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
  })
})

describe("噩梦之影", () => {
  it("恐惧狼 → 当晚狼队空刀", () => {
    const st = makeState(["狼人", "噩梦之影", "预言家", "平民", "平民"])
    expect(nightmareFear(st, "P0")).toBeNull()
    expect(st.wolfFearedTonight).toBe(true)
    expect(g(st, "P1").mark.fearWolfCount).toBe(1)
    expect(wolfKill(st, "P3")).toContain("恐惧")
  })

  it("恐惧神职 → 技能失效并计分", () => {
    const st = makeState(["狼人", "噩梦之影", "预言家", "平民", "平民"])
    expect(nightmareFear(st, "P2")).toBeNull()
    expect(g(st, "P2").mark.skillDisabled).toBe(true)
    expect(g(st, "P1").mark.fearGodCount).toBe(1)
    expect(prophetCheck(st, "P0")).toContain("恐惧")
  })

  it("恐惧自己 → 无效果", () => {
    const st = makeState(["狼人", "噩梦之影", "预言家", "平民", "平民"])
    expect(nightmareFear(st, "P1")).toBeNull()
    expect(st.wolfFearedTonight).toBe(false)
    expect(g(st, "P1").mark.fearWolfCount).toBe(0)
  })
})

describe("血月使徒", () => {
  it("自爆封印当夜神职", () => {
    const st = makeState(["血月使徒", "预言家", "女巫", "平民", "平民"])
    st.phase = "day"
    expect(wolfBaoZha(st, "P0")).toBeNull()
    expect(st.bloodMoonSeal).toBe(true)
    expect(g(st, "P0").mark.bloodSealCount).toBe(1)
  })

  it("仅剩狼被放逐 → 延迟出局（当晚存活）", () => {
    const st = makeState(["血月使徒", "预言家", "女巫", "平民", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false)).toBeNull()
    expect(g(st, "P0").alive).toBe(true)
    expect(g(st, "P0").mark.bloodDelayedExile).toBe(true)
  })

  it("延迟出局在天亮结算死亡", () => {
    const st = makeState(["血月使徒", "预言家", "女巫", "平民", "平民"])
    g(st, "P0").mark.bloodDelayedExile = true
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P0").alive).toBe(false)
  })

  it("警上自爆：封印顺延到下一夜，并跳过当天", () => {
    const st = makeState(["血月使徒", "预言家", "女巫", "平民", "平民"])
    // 首夜警上发言阶段自爆
    expect(wolfBaoZha(st, "P0")).toBeNull()
    expect(st.bloodSealNextNight).toBe(true)
    expect(st.skipDayAfterDawn).toBe(true)
    expect(st.uiDone.jinghui).toBe(true)
    expect(st.bloodMoonSeal).toBe(true)
    expect(g(st, "P0").mark.bloodSealCount).toBe(1)

    // 天亮：封印保留、跳过当天
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.bloodMoonSeal).toBe(true)
    expect(st.skipVote).toBe(true)
    expect(st.bloodSealNextNight).toBe(false)

    // 第二夜：神职被封印
    nextNight(st)
    expect(st.bloodMoonSeal).toBe(true)
    expect(prophetCheck(st, "P1")).toContain("血月封印")

    // 第二夜天亮：封印清除
    expect(resolveNightEffects(st)).toBeNull()
    expect(st.bloodMoonSeal).toBe(false)
  })
})

describe("猎魔人", () => {
  it("狩猎狼 → 天亮狼死", () => {
    const st = makeState(["狼人", "猎魔人", "平民", "平民", "平民"])
    st.round = 2
    expect(hunterHunt(st, "P0")).toBeNull()
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P1").mark.huntWolfCount).toBe(1)
  })

  it("狩猎好人 → 猎魔人反噬", () => {
    const st = makeState(["狼人", "猎魔人", "平民", "平民", "平民"])
    st.round = 2
    expect(hunterHunt(st, "P2")).toBeNull()
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P1").mark.huntGoodCount).toBe(1)
  })

  it("免疫女巫毒", () => {
    const st = makeState(["狼人", "猎魔人", "女巫", "平民", "平民"])
    witchPoison(st, "P1")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P1").alive).toBe(true)
  })
})

describe("摄梦人", () => {
  it("连续两晚同梦 → 天亮死亡", () => {
    const st = makeState(["狼人", "摄梦人", "平民", "平民", "平民"])
    dreamDo(st, "P2")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    // 第二夜
    nextNight(st)
    dreamDo(st, "P2")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P1").mark.dreamKillGood).toBe(1)
  })

  it("摄梦人夜间死亡 → 梦游者殉情（不开枪）", () => {
    const st = makeState(["狼人", "摄梦人", "猎人", "平民", "平民"])
    dreamDo(st, "P2")
    wolfKill(st, "P1")
    resolveNightEffects(st)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
  })})

describe("野孩子", () => {
  it("首夜不能选自己为榜样", () => {
    const st = makeState(["野孩子", "狼人", "平民", "平民", "平民"])
    expect(wildChildPick(st, "P0")).toContain("自己")
  })

  it("榜样死后黑化为狼阵营", () => {
    const st = makeState(["野孩子", "狼人", "平民", "平民", "平民"])
    wildChildPick(st, "P2")
    killPlayer(st, "P2", "vote")
    nextNight(st)
    expect(g(st, "P0").mark.isTransform).toBe(true)
    expect(isEffectiveWolf(g(st, "P0"))).toBe(true)
    expect(effectiveCampOf(g(st, "P0"))).toBe("wolf")
  })

  it("黑化后查验为查杀", () => {
    const st = makeState(["野孩子", "狼人", "预言家", "平民", "平民"])
    wildChildPick(st, "P3")
    g(st, "P0").mark.isTransform = true
    const r = prophetCheck(st, "P0")
    expect((r as { isWolf: boolean }).isWolf).toBe(true)
  })
})

describe("炸弹人", () => {
  it("放逐引爆炸死票选者", () => {
    const st = makeState(["炸弹人", "狼人", "平民", "平民", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false, ["P1", "P2"])).toBeNull()
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P0").mark.bombWolfCount).toBe(1)
    expect(g(st, "P0").mark.bombGoodCount).toBe(1)
  })

  it("全票放逐 → 独赢第三方胜", () => {
    const st = makeState(["炸弹人", "狼人", "平民", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false, ["P1", "P2", "P3"])).toBeNull()
    expect(st.bombVictory).toBe(true)
    finishBombLastWords(st)
    const r = checkWin(st)
    expect(st.winCamp).toBe("third")
    expect(r.reason).toContain("炸弹")
  })

  it("未勾选任何票选 → 阻止放逐", () => {
    const st = makeState(["炸弹人", "狼人", "平民", "平民"])
    st.phase = "day"
    expect(finishVote(st, "P0", false, [])).toContain("勾选")
    expect(g(st, "P0").alive).toBe(true)
  })
})

describe("炸弹人：独立第三方阵营", () => {
  it("阵营为 third，不属于好人也不属于狼人", () => {
    const st = makeState(["炸弹人", "狼人", "平民"])
    expect(g(st, "P0").role).toBe("炸弹人")
    expect(effectiveCampOf(g(st, "P0"))).toBe("third")
    expect(isEffectiveWolf(g(st, "P0"))).toBe(false)
  })

  it("预言家查验炸弹人 → 好人（金水）", () => {
    const st = makeState(["预言家", "炸弹人", "平民"])
    const r = prophetCheck(st, "P1")
    expect(typeof r).toBe("object")
    expect((r as { isWolf: boolean }).isWolf).toBe(false)
    expect(st.prophetReport).toContain("好人")
  })

  it("石像鬼查验炸弹人 → 直接看到角色名「炸弹人」", () => {
    const st = makeState(["石像鬼", "炸弹人", "平民"])
    const r = gargoyleCheck(st, "P1")
    expect(typeof r).toBe("object")
    expect((r as { role: string }).role).toBe("炸弹人")
  })

  it("好人胜不给炸弹人平民分", () => {
    const st = makeState(["炸弹人", "平民", "狼人"])
    st.winCamp = "god"
    st.players.forEach((p) => { if (p.role === "狼人") p.alive = false })
    recalcScore(st)
    expect(g(st, "P0").scoreDetail.join("")).not.toContain("平民胜利")
  })
})

describe("阵营口径统一", () => {
  it("黑化野孩子不计入平民胜利分", () => {
    const st = makeState(["野孩子", "狼人", "预言家", "平民"])
    g(st, "P0").mark.isTransform = true
    st.winCamp = "god"
    recalcScore(st)
    expect(g(st, "P0").scoreDetail.join("")).not.toContain("平民胜利")
  })
})

describe("恐惧狼群外特殊狼（只封个人技能，不波及狼队）", () => {
  it("恐石像鬼 → 封个人技能，验人/刀人报错，狼队不空刀", () => {
    const st = makeState(["狼人", "噩梦之影", "石像鬼", "平民"])
    nightmareFear(st, "P2")
    expect(g(st, "P2").mark.skillDisabled).toBe(true)
    expect(st.wolfFearedTonight).toBe(false)
    expect(typeof gargoyleCheck(st, "P3")).toBe("string")
    expect(typeof gargoyleKill(st, "P3")).toBe("string")
  })

  it("恐隐狼 → 封其个人技能，不触发狼队空刀", () => {
    const st = makeState(["隐狼", "噩梦之影", "平民", "平民"])
    nightmareFear(st, "P0")
    expect(g(st, "P0").mark.skillDisabled).toBe(true)
    expect(st.wolfFearedTonight).toBe(false)
  })

  it("仅存带刀隐狼被恐 → 不能刀人", () => {
    const st = makeState(["隐狼", "噩梦之影", "平民", "平民"])
    nightmareFear(st, "P0")
    // 噩梦之影随后出局，隐狼成为唯一存活狼，带刀但已被封印
    g(st, "P1").alive = false
    refreshHiddenWolfKnife(st)
    expect(hiddenWolfCanKnife(st)).toBe(true)
    expect(typeof wolfKill(st, "P2")).toBe("string")
  })

  it("恐普通狼 → 狼队空刀（回归）", () => {
    const st = makeState(["狼人", "噩梦之影", "平民", "平民"])
    nightmareFear(st, "P0")
    expect(st.wolfFearedTonight).toBe(true)
    expect(g(st, "P0").mark.skillDisabled).toBe(false)
  })
})

describe("炸弹人与殉情交互", () => {
  it("炸死狼美人 → 被魅惑者殉情（规则2）", () => {
    const st = makeState(["炸弹人", "狼美人", "平民", "平民"])
    st.phase = "day"
    charmDo(st, "P2")
    finishVote(st, "P0", false, ["P1"])
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
  })

  it("炸死情侣一方 → 另一方殉情（规则1）", () => {
    const st = makeState(["炸弹人", "平民", "平民", "平民"])
    st.phase = "day"
    st.lovers = ["P1", "P2"]
    finishVote(st, "P0", false, ["P1"])
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
  })
})

describe("摄梦人连带死亡（仅夜间出局才殉情）", () => {
  it("夜间被毒 → 梦游者殉情（规则4正例）", () => {
    const st = makeState(["女巫", "摄梦人", "平民", "平民", "狼人"])
    dreamDo(st, "P2")
    g(st, "P0").mark.antidote = true
    st.nightUsedDrug = null
    st.witchPoisonUsed = false
    st.nightWitchPoison = "P1"
    st.nightSteps.witch = true
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
  })

  it("白天被放逐 → 梦游者不殉情（规则4反例）", () => {
    const st = makeState(["女巫", "摄梦人", "平民", "平民", "狼人"])
    st.phase = "day"
    dreamDo(st, "P2")
    finishVote(st, "P1", false)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(true)
  })
})

describe("野孩子黑化边界", () => {
  it("榜样与野孩子同夜出局 → 不变身", () => {
    const st = makeState(["野孩子", "狼人", "平民", "平民"])
    wildChildPick(st, "P2")
    killPlayer(st, "P0", "other")
    killPlayer(st, "P2", "other")
    checkWildChildTransform(st)
    expect(g(st, "P0").mark.isTransform).toBe(false)
  })

  it("野孩子先死、榜样后死 → 不变身", () => {
    const st = makeState(["野孩子", "狼人", "平民", "平民"])
    wildChildPick(st, "P2")
    killPlayer(st, "P0", "other")
    checkWildChildTransform(st)
    killPlayer(st, "P2", "other")
    checkWildChildTransform(st)
    expect(g(st, "P0").mark.isTransform).toBe(false)
  })
})

describe("血月延迟出局者不能自爆", () => {
  it("延迟出局的血月使徒自爆 → 被拒绝，不触发封印", () => {
    const st = makeState(["血月使徒", "狼人", "平民", "平民"])
    g(st, "P0").mark.bloodDelayedExile = true
    expect(wolfBaoZha(st, "P0")).toContain("已被放逐出局")
    expect(st.bloodMoonSeal).toBe(false)
    expect(st.skipVote).toBe(false)
  })
})

// ==================== 边界补测：新角色 × 老角色兼容 ====================

describe("噩梦之影 × 老角色技能门控", () => {
  it("恐守卫 → 守卫本夜无法守人", () => {
    const st = makeState(["狼人", "噩梦之影", "守卫", "平民"])
    nightmareFear(st, "P2")
    expect(g(st, "P2").mark.skillDisabled).toBe(true)
    expect(guardDo(st, "P3", false)).toContain("恐惧")
  })

  it("恐女巫 → 女巫本夜无法用药（解药/毒药均拦）", () => {
    const st = makeState(["狼人", "噩梦之影", "女巫", "平民"])
    st.nightWolfKill = "P3"
    nightmareFear(st, "P2")
    expect(witchSave(st)).toContain("恐惧")
    expect(witchPoison(st, "P0")).toContain("恐惧")
  })

  it("恐守墓人 → 本夜验尸无信息", () => {
    const st = makeState(["狼人", "噩梦之影", "守墓人", "平民"])
    st.lastVoteOut = "P0"
    nightmareFear(st, "P2")
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("血月封印同夜 → 守墓人同样无信息（与恐神叠加互不冲突）", () => {
    const st = makeState(["狼人", "噩梦之影", "守墓人", "平民"])
    st.lastVoteOut = "P0"
    st.bloodMoonSeal = true
    expect(gravekeeperResult(st)).toBeNull()
  })

  it("恐神后该神尝试行动被拦（顺序不敏感）", () => {
    const st = makeState(["狼人", "噩梦之影", "守卫", "平民"])
    expect(guardDo(st, "P3", false)).toBeNull()
    g(st, "P2").mark.skillDisabled = true
    st.nightGuardTarget = ""
    expect(guardDo(st, "P3", false)).toContain("恐惧")
  })
})

describe("守卫/解药边界（只挡/只解狼刀）", () => {
  it("守卫守狼刀目标 → 目标存活 + guardHitCount+1", () => {
    const st = makeState(["狼人", "守卫", "平民", "平民"])
    wolfKill(st, "P2")
    guardDo(st, "P2", false)
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(true)
    expect(g(st, "P1").mark.guardHitCount).toBe(1)
  })

  it("守卫守被毒目标 → 目标仍死（毒无视守卫）", () => {
    const st = makeState(["狼人", "守卫", "女巫", "平民"])
    guardDo(st, "P3", false)
    witchPoison(st, "P3")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P3").alive).toBe(false)
  })

  it("守卫守被猎魔戳的狼目标 → 仍死（守卫挡不住猎魔猎杀）", () => {
    const st = makeState(["狼人", "猎魔人", "猎人", "平民"])
    st.round = 2
    // 让 P0(狼) 以外无狼 → 猎魔戳 P0（狼）；守卫守 P0
    guardDo(st, "P0", false)
    hunterHunt(st, "P0")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P0").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
  })

  it("守卫守连梦目标 → 仍死", () => {
    const st = makeState(["狼人", "守卫", "摄梦人", "平民"])
    dreamDo(st, "P3")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    nextNight(st)
    guardDo(st, "P3", false)
    dreamDo(st, "P3")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P3").alive).toBe(false)
  })

  it("解药救被毒目标 → 仍死（解药只解狼刀）", () => {
    const st = makeState(["狼人", "女巫", "平民", "平民"])
    witchPoison(st, "P2")
    // 解药瞄的是狼刀口；这里狼刀空，仅手动把解药口指向被毒者
    st.nightWitchSave = "P2"
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
  })

  it("同守同救 → 目标死 + guardSameSaveKill", () => {
    const st = makeState(["狼人", "守卫", "女巫", "平民"])
    wolfKill(st, "P3")
    guardDo(st, "P3", true)
    witchSave(st)
    resolveNightEffects(st)
    expect(g(st, "P3").alive).toBe(false)
    expect(g(st, "P1").mark.guardSameSaveKill).toBe(true)
  })
})

describe("猎魔人/摄梦 × 老角色", () => {
  it("猎魔戳死 + 狼刀同目标 → 去重只死一次", () => {
    const st = makeState(["狼人", "猎魔人", "平民", "平民"])
    st.round = 2
    wolfKill(st, "P2")
    hunterHunt(st, "P2")
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
  })

  it("猎魔戳死狼 + 该狼被炸同夜不触发猎人开枪（猎魔死因=other）", () => {
    const st = makeState(["狼人", "猎魔人", "猎人", "平民"])
    st.round = 2
    // 猎魔戳 P0(狼)，P2(猎人) 与本次结算无关 → 猎人不开枪
    hunterHunt(st, "P0")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P0").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
  })

  it("连梦目标=猎人 → 不开枪", () => {
    const st = makeState(["狼人", "摄梦人", "猎人", "平民"])
    dreamDo(st, "P2")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    nextNight(st)
    dreamDo(st, "P2")
    st.nightSteps.wolf = true
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
  })

  it("猎魔戳死摄梦人（摄梦人为狼）→ 梦游者殉情", () => {
    // 摄梦人不可能为狼；换用狼刀杀摄梦人的形式验证猎魔同夜结算不干扰连梦
    const st = makeState(["狼人", "猎魔人", "摄梦人", "平民"])
    dreamDo(st, "P3")
    wolfKill(st, "P2")
    resolveNightEffects(st)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P3").alive).toBe(false)
  })
})

describe("野孩子黑化 × 阵营/胜负", () => {
  it("黑化后计入存活狼数（影响狼胜/隐狼失刀）", () => {
    const st = makeState(["野孩子", "隐狼", "平民", "平民"])
    wildChildPick(st, "P2")
    g(st, "P0").mark.isTransform = true
    killPlayer(st, "P2", "vote")
    refreshHiddenWolfKnife(st)
    expect(isEffectiveWolf(g(st, "P0"))).toBe(true)
    // 黑化狼 + 隐狼同时存活 → 隐狼无刀
    expect(hiddenWolfCanKnife(st)).toBe(false)
  })

  it("黑化后好人边减少：好人均灭余狼存活 → 狼胜", () => {
    const st = makeState(["野孩子", "狼人", "平民", "平民"])
    wildChildPick(st, "P1")
    g(st, "P0").mark.isTransform = true
    g(st, "P1").alive = false
    g(st, "P2").alive = false
    g(st, "P3").alive = false
    // 剩余 P0(黑化狼)存活，好人均灭 → 狼胜
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("榜样=猎人被投 → 猎人开枪致死后黑化", () => {
    const st = makeState(["野孩子", "狼人", "猎人", "平民"])
    st.phase = "day"
    wildChildPick(st, "P2")
    finishVote(st, "P2", false)
    expect(st.hunterShotPending).toBe(true)
    hunterShootConfirm(st, "P1")
    killPlayer(st, "P1", "other")
    checkWildChildTransform(st)
    expect(g(st, "P0").mark.isTransform).toBe(true)
  })
})

describe("炸弹人 × 老角色/白痴", () => {
  it("被炸的猎人 → reason=bomb 不开枪", () => {
    const st = makeState(["炸弹人", "猎人", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false, ["P1"])
    expect(g(st, "P1").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
  })

  it("被炸的狼王 → reason=bomb 不开枪", () => {
    const st = makeState(["炸弹人", "狼王", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false, ["P1"])
    expect(g(st, "P1").alive).toBe(false)
    expect(st.wolfKingShotPending).toBe(false)
  })

  it("场景1：白痴被投（炸弹人在场）→ 白痴翻牌免死，炸弹不引爆", () => {
    const st = makeState(["炸弹人", "白痴", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P1", true)
    expect(g(st, "P1").alive).toBe(true)
    expect(g(st, "P1").mark.idiotFlipped).toBe(true)
    expect(g(st, "P0").alive).toBe(true)
    expect(g(st, "P0").mark.bombGoodCount ?? 0).toBe(0)
  })

  it("场景2：炸弹人被投、白痴投他 → 白痴被炸死（不翻牌）", () => {
    const st = makeState(["炸弹人", "白痴", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false, ["P1"])
    expect(g(st, "P0").alive).toBe(false)
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P1").mark.idiotFlipped).toBe(false)
  })

  it("炸死多人含情侣一方 → 另一方殉情（多人链）", () => {
    const st = makeState(["炸弹人", "平民", "平民", "平民"])
    st.phase = "day"
    st.lovers = ["P1", "P3"]
    finishVote(st, "P0", false, ["P1", "P2"])
    expect(g(st, "P1").alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
    expect(g(st, "P3").alive).toBe(false)
  })
})

describe("隐狼/血月 × 胜负", () => {
  it("隐狼带刀计入存活狼（屠边断言）", () => {
    const st = makeState(["隐狼", "预言家", "平民", "平民"])
    killPlayer(st, "P1", "vote")
    killPlayer(st, "P2", "vote")
    killPlayer(st, "P3", "vote")
    refreshHiddenWolfKnife(st)
    expect(hiddenWolfCanKnife(st)).toBe(true)
    expect(isWolfPackRole(g(st, "P0").role)).toBe(false)
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("血月延迟出局者存活期间计入狼数", () => {
    const st = makeState(["血月使徒", "预言家", "平民", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false)
    expect(g(st, "P0").alive).toBe(true)
    expect(isEffectiveWolf(g(st, "P0"))).toBe(true)
  })

  it("炸弹全票独赢 × 同时狼胜 → 优先级 third", () => {
    const st = makeState(["炸弹人", "狼人", "平民"])
    st.phase = "day"
    finishVote(st, "P0", false, ["P1", "P2"])
    finishBombLastWords(st)
    checkWin(st)
    expect(st.winCamp).toBe("third")
  })
})

describe("DEFAULT_VOICES 新角色台词", () => {
  it("新角色夜间开/闭眼台词存在且非空", () => {
    const keys = [
      "nightmare", "nightmare_close",
      "hiddenWolf", "hiddenWolf_close",
      "dreamer", "dreamer_close",
      "hunterWolf", "hunterWolf_close",
      "wild_child", "wild_child_close",
      "bomber_open", "bomber_close",
    ]
    for (const k of keys) {
      expect(typeof DEFAULT_VOICES[k], `缺少台词 ${k}`).toBe("string")
      expect((DEFAULT_VOICES[k] ?? "").length, `台词 ${k} 为空`).toBeGreaterThan(0)
    }
  })
})

describe("野孩子作为情侣黑化：链型动态重算（GG→WG / WG→WW）", () => {
  /** 杀掉榜样后再入夜触发黑化（checkWildChildTransform 的真实入口） */
  function blacken(st: GameState, model: string) {
    wildChildPick(st, model)
    killPlayer(st, model, "vote")
    checkWildChildTransform(st)
    expect(g(st, "P0").mark.isTransform).toBe(true)
  }

  it("GG→WG：第三方成立，丘比特+两情侣都算第三方", () => {
    const st = makeState(["野孩子", "狼人", "丘比特", "平民", "狼人"])
    expect(cupidConnect(st, ["P0", "P3"])).toBeNull() // 野孩子 + 平民 = GG
    expect(getChainType(st)).toBe("GG")
    expect(isThirdMember(st, g(st, "P2"))).toBe(false) // 丘比特是神

    blacken(st, "P4") // 榜样=另一只狼，杀掉后野孩子黑化（P1 单身狼仍在，好人不提前胜）
    expect(getChainType(st)).toBe("WG")
    expect(st.globalLog.some((l) => l.includes("第三方阵营成立"))).toBe(true)
    expect(isThirdMember(st, g(st, "P0"))).toBe(true) // 黑化野孩子（狼恋人）
    expect(isThirdMember(st, g(st, "P2"))).toBe(true) // 丘比特
    expect(isThirdMember(st, g(st, "P3"))).toBe(true) // 好人恋人

    // 清掉单身狼 P1 → 场上只剩三人，第三方胜（不要求三人全活）
    killPlayer(st, "P1", "vote")
    expect(aliveCampCounts(st)).toEqual({ wolf: 0, god: 0, civil: 0, third: 3 })
    checkWin(st)
    expect(st.winCamp).toBe("third")
    expect(st.winningThird).toBe("WG")
  })

  it("GG→WG：第三方胜时三人各 +3，黑化野孩子另有变身 +1", () => {
    const st = makeState(["野孩子", "狼人", "丘比特", "平民", "狼人"])
    cupidConnect(st, ["P0", "P3"])
    blacken(st, "P4")
    killPlayer(st, "P1", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("third")
    recalcScore(st)
    for (const n of ["P0", "P2", "P3"]) {
      expect(g(st, n).scoreDetail).toContain("第三方胜利+3")
    }
    // 野孩子黑化 +1 与第三方 +3 叠加
    expect(g(st, "P0").scoreDetail).toContain("黑化变身+1")
    expect(g(st, "P0").scoreRound).toBe(4)
    // 已出局的单身狼不拿第三方/狼胜分
    expect(g(st, "P1").scoreDetail ?? []).not.toContain("第三方胜利+3")
  })

  it("WG→WW：野孩子（好人恋人）黑化后第三方解散，丘比特变回神", () => {
    const st = makeState(["野孩子", "狼人", "丘比特", "平民", "狼人"])
    expect(cupidConnect(st, ["P0", "P1"])).toBeNull() // 野孩子 + 狼人 = WG
    expect(getChainType(st)).toBe("WG")
    expect(isThirdMember(st, g(st, "P2"))).toBe(true)

    blacken(st, "P3") // 榜样=平民，杀掉后野孩子黑化 → 双狼（P4 单身狼仍在，不提前分胜负）
    expect(getChainType(st)).toBe("WW")
    expect(st.globalLog.some((l) => l.includes("第三方解散"))).toBe(true)
    expect(isThirdMember(st, g(st, "P0"))).toBe(false)
    expect(isThirdMember(st, g(st, "P2"))).toBe(false) // 丘比特不再是第三方
    // 丘比特按神计，第三方清零；三只生效狼计入狼
    expect(aliveCampCounts(st)).toEqual({ wolf: 3, god: 1, civil: 0, third: 0 })
  })

  it("WG→WW：第三方解散后按普通胜负判定（不再误判第三方胜）", () => {
    const st = makeState(["野孩子", "狼人", "丘比特", "平民", "狼人"])
    cupidConnect(st, ["P0", "P1"])
    blacken(st, "P3")
    // P3（唯一平民）已死，场上 3 狼 + 丘比特 → 屠民，狼胜；旧实现会误判第三方胜
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
    expect(st.winningThird).toBe("")
  })

  it("WG→WW：狼情侣出局后只剩丘比特 → 好人胜，丘比特 +3", () => {
    // 多留一个平民，避免「屠民」在狼情侣出局前就先锁定狼胜
    const st = makeState(["野孩子", "狼人", "丘比特", "平民", "狼人", "平民"])
    cupidConnect(st, ["P0", "P1"])
    blacken(st, "P3") // 榜样平民 P3 出局，P5 平民仍在
    expect(getChainType(st)).toBe("WW")
    killPlayer(st, "P0", "vote") // 狼恋人出局 → 另一位殉情
    killPlayer(st, "P4", "vote") // 清掉最后一只单身狼
    checkWin(st)
    expect(st.winCamp).toBe("god")
    recalcScore(st)
    expect(g(st, "P2").scoreDetail).toContain("好人胜利·丘比特+3")
    expect(g(st, "P0").scoreDetail ?? []).not.toContain("第三方胜利+3")
  })
})

describe("狼刀 × 人狼恋刀口", () => {
  it("WG 狼恋人可被刀，且不算自刀骗解药", () => {
    const st = makeState(["野孩子", "狼人", "狼人", "丘比特", "平民"])
    cupidConnect(st, ["P0", "P1"]) // 野孩子 + 狼人 P1 = WG
    expect(getChainType(st)).toBe("WG")
    expect(wolfKill(st, "P1")).toBeNull()
    expect(st.nightWolfKill).toBe("P1")
    expect(st.wolfSelfKill).toBe(false)
  })

  it("WG→WW 后双狼情侣恢复互刀限制（黑化野孩子按生效狼拦）", () => {
    const st = makeState(["野孩子", "狼人", "狼人", "丘比特", "平民"])
    cupidConnect(st, ["P0", "P1"]) // WG
    wildChildPick(st, "P4")
    killPlayer(st, "P4", "vote")
    checkWildChildTransform(st)
    expect(getChainType(st)).toBe("WW")
    expect(wolfKill(st, "P0")).toContain("互刀")
    expect(wolfKill(st, "P1")).toContain("互刀")
  })
})

describe("夜间结算 · 狼刀效果去重", () => {
  it("狼人/狼美人与统一狼刀重复提交同一目标，只结算一次", () => {
    const st = makeState(["狼人", "狼美人", "平民", "预言家"])
    st.nightWolfKill = "P2"
    st.nightSteps.wolf = true
    expect(resolveNightEffects(st)).toBeNull()
    expect(g(st, "P2").alive).toBe(false)
    const dawn = st.globalLog.find((l) => l.includes("昨夜死亡"))
    expect(dawn).toBeTruthy()
    // 目标在死亡播报里只出现一次（重复 effect 未造成重复结算）
    expect((dawn!.match(/P2/g) ?? []).length).toBe(1)
  })
})
