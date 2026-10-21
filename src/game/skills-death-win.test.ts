import { describe, it, expect } from "bun:test"
import {
  defaultState,
  newPlayer,
  nextNight,
  resolveNightDeath,
  checkWin,
  killPlayer,
  prophetCheck,
  wolfKill,
  wolfBaoZha,
  wolfKingBaoZha,
  wolfKingShootConfirm,
  witchSave,
  witchPoison,
  guardDo,
  knightDuel,
  hunterShootConfirm,
  cupidConnect,
  setJingHui,
  finishVote,
  type GameState,
  type Player,
} from "./logic"

/**
 * 补充回归用例：角色技能错误路径、死亡先后顺序（殉情/开枪连锁）、胜利边界。
 * 已有覆盖见 logic.test.ts（技能基础）与 integration.test.ts（场景交叉），
 * 此处只锁定此前未覆盖的行为，期望值经真实运行验证。
 */

// 12 人含丘比特板子：P0-P3狼 P4预言家 P5女巫 P6猎人 P7丘比特 P8-P11平民
function setupQ(mode: "edge" | "city" = "edge"): GameState {
  const st = defaultState()
  st.board = "12q"
  st.winMode = mode
  st.players = ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "丘比特", "平民", "平民", "平民", "平民"].map(
    (r, i) => {
      const p = newPlayer("P" + i)
      p.role = r
      return p
    },
  )
  st.phase = "day"
  st.round = 1
  return st
}

function setup(roles?: string[]): GameState {
  const st = defaultState()
  st.players = (roles ?? ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "平民"]).map(
    (r, i) => {
      const p = newPlayer("P" + i)
      p.role = r
      return p
    },
  )
  st.phase = "day"
  st.round = 1
  return st
}

function g(st: GameState, name: string): Player {
  const p = st.players.find((x) => x.name === name)
  if (!p) throw new Error("not found " + name)
  return p
}
function byRole(st: GameState, role: string): Player {
  const p = st.players.find((x) => x.role === role)
  if (!p) throw new Error("no role " + role)
  return p
}
/** 状态简写：存活/死因 */
const stt = (st: GameState, name: string) => `${g(st, name).alive ? "活" : "死"}/${g(st, name).deathReason || "-"}`

// ==================== 角色技能：错误路径 ====================

describe("白狼王自爆带人 · 技能校验", () => {
  it("不能带走自己", () => {
    const st = setup()
    g(st, "P0").role = "白狼王"
    expect(wolfKingBaoZha(st, "P0", "P0")).toBe("不能带走自己")
    expect(g(st, "P0").alive).toBe(true)
    expect(st.skipVote).toBe(false)
  })

  it("目标已出局不能带", () => {
    const st = setup()
    g(st, "P0").role = "白狼王"
    g(st, "P9").alive = false
    expect(wolfKingBaoZha(st, "P0", "P9")).toBe("目标已出局")
    expect(g(st, "P0").alive).toBe(true)
  })

  it("非白狼王不能用带人自爆", () => {
    const st = setup()
    expect(wolfKingBaoZha(st, "P0", "P5")).toBe("只能选择白狼王自爆带人")
    expect(g(st, "P0").alive).toBe(true)
    expect(g(st, "P5").alive).toBe(true)
  })

  it("未选自爆者/未选目标分别被拦", () => {
    const st = setup()
    expect(wolfKingBaoZha(st, "", "P5")).toBe("请选择自爆的白狼王")
    expect(wolfKingBaoZha(st, "P0", "")).toBe("请选择带走的目标")
  })

  it("白狼王带走白痴：白痴直接出局（翻牌只在被放逐时触发）", () => {
    const st = setup()
    g(st, "P0").role = "白狼王"
    expect(wolfKingBaoZha(st, "P0", "P7")).toBeNull()
    expect(g(st, "P7").alive).toBe(false)
    expect(g(st, "P7").mark.idiotFlipped).toBe(false)
    expect(st.skipVote).toBe(true)
  })

  it("白狼王带走警长：警徽置 pending 待移交（非自爆者不直接流失）", () => {
    const st = setup()
    g(st, "P0").role = "白狼王"
    setJingHui(st, "P4", false)
    expect(wolfKingBaoZha(st, "P0", "P4")).toBeNull()
    expect(g(st, "P4").alive).toBe(false)
    expect(st.badgePending).toBe("P4")
    expect(st.jingHui).toBe("P4") // 待法官移交/流失，不自动清空
  })
})

describe("狼人自爆 · 技能校验", () => {
  it("好人不能自爆", () => {
    const st = setup()
    expect(wolfBaoZha(st, "P3")).toBe("只能狼阵营玩家自爆")
    expect(g(st, "P3").alive).toBe(true)
  })

  it("已出局者不能自爆", () => {
    const st = setup()
    g(st, "P0").alive = false
    expect(wolfBaoZha(st, "P0")).toBe("该玩家已出局")
  })

  it("未选择自爆者被拦", () => {
    const st = setup()
    expect(wolfBaoZha(st, "")).toBe("请选择自爆的狼人")
  })
})

describe("出局玩家不能再操作", () => {
  it("守卫已出局不能守人", () => {
    const st = setup()
    byRole(st, "守卫").alive = false
    expect(guardDo(st, "P8", false)).toBe("守卫已出局，本晚不能守人")
  })

  it("女巫已出局不能用解药/毒药", () => {
    const st = setup()
    byRole(st, "女巫").alive = false
    nextNight(st)
    wolfKill(st, "P8")
    expect(witchSave(st)).toBe("女巫已出局，本晚不能用药")
    expect(witchPoison(st, "P7")).toBe("女巫已出局，本晚不能用药")
    expect(g(st, "P7").alive).toBe(true)
  })
})

// ==================== 死亡先后顺序：殉情与开枪连锁 ====================

describe("死亡先后顺序 · 殉情连锁", () => {
  it("白狼王带走情侣之一：伴侣殉情，被带走的猎人不开枪", () => {
    const st = setupQ()
    g(st, "P0").role = "白狼王"
    expect(cupidConnect(st, ["P6", "P8"])).toBeNull() // 猎人 + 平民
    expect(wolfKingBaoZha(st, "P0", "P6")).toBeNull()
    expect(stt(st, "P6")).toBe("死/other")
    expect(stt(st, "P8")).toBe("死/lover") // 伴侣殉情
    expect(st.hunterShotPending).toBe(false) // 被带走 + 殉情均不开枪
  })

  it("白狼王自己是恋人：自爆后伴侣殉情", () => {
    const st = setupQ()
    g(st, "P0").role = "白狼王"
    expect(cupidConnect(st, ["P0", "P8"])).toBeNull() // 人狼恋
    expect(wolfKingBaoZha(st, "P0", "P6")).toBeNull()
    expect(stt(st, "P0")).toBe("死/selfBomb")
    expect(stt(st, "P6")).toBe("死/other")
    expect(stt(st, "P8")).toBe("死/lover") // 白狼王的伴侣殉情
  })

  it("骑士戳死狼人：狼的恋人殉情", () => {
    const st = setupQ()
    g(st, "P6").role = "骑士"
    expect(cupidConnect(st, ["P8", "P0"])).toBeNull() // 平民 + 狼人 人狼恋
    expect(knightDuel(st, "P0")).toBeNull()
    expect(stt(st, "P0")).toBe("死/duel")
    expect(stt(st, "P8")).toBe("死/lover")
    expect(st.knightDuelUsed).toBe(true)
  })

  it("骑士戳错好人：骑士出局，骑士的恋人殉情", () => {
    const st = setupQ()
    g(st, "P6").role = "骑士"
    expect(cupidConnect(st, ["P6", "P8"])).toBeNull() // 骑士 + 平民 人人恋
    expect(knightDuel(st, "P7")).toBeNull() // 戳丘比特（好人）
    expect(stt(st, "P6")).toBe("死/duel")
    expect(stt(st, "P8")).toBe("死/lover")
  })

  it("猎人被放逐：伴侣先殉情，猎人仍可开枪带走第三人", () => {
    const st = setupQ()
    expect(cupidConnect(st, ["P6", "P8"])).toBeNull()
    expect(finishVote(st, "P6", false)).toBeNull()
    expect(stt(st, "P6")).toBe("死/vote")
    expect(stt(st, "P8")).toBe("死/lover") // 殉情在 killPlayer 内先行级联
    expect(st.hunterShotPending).toBe(true) // 放逐开枪权不受殉情影响
    expect(hunterShootConfirm(st, "P0")).toBeNull()
    expect(stt(st, "P0")).toBe("死/shot")
    expect(st.hunterShotPending).toBe(false)
  })

  it("狼人夜刀情侣之一：伴侣殉情，殉情的猎人不开枪", () => {
    const st = setupQ()
    expect(cupidConnect(st, ["P8", "P6"])).toBeNull() // 平民 + 猎人
    nextNight(st)
    wolfKill(st, "P8")
    resolveNightDeath(st)
    expect(stt(st, "P8")).toBe("死/wolfKill")
    expect(stt(st, "P6")).toBe("死/lover")
    expect(st.hunterShotPending).toBe(false) // 殉情死不开枪（对照：被刀死才开枪）
  })

  it("猎人被刀（非殉情）照常开枪，作为对照", () => {
    const st = setupQ()
    nextNight(st)
    wolfKill(st, "P6")
    resolveNightDeath(st)
    expect(stt(st, "P6")).toBe("死/wolfKill")
    expect(st.hunterShotPending).toBe(true)
  })
})

describe("死亡先后顺序 · 开枪连锁与吞枪", () => {
  it("猎人开枪带走狼王：狼王触发开枪（shot 死因有开枪权）", () => {
    const st = setup()
    const hunter = byRole(st, "猎人")
    const wk = byRole(st, "狼人")
    wk.role = "狼王"
    hunter.alive = false
    st.hunterShotPending = true
    expect(hunterShootConfirm(st, wk.name)).toBeNull()
    expect(wk.alive).toBe(false)
    expect(st.wolfKingShotPending).toBe(true)
    expect(wolfKingShootConfirm(st, "P7")).toBeNull()
  })

  it("白狼王带走猎人：猎人无开枪权（对照：被狼王枪杀则有）", () => {
    const st = setup()
    g(st, "P0").role = "白狼王"
    expect(wolfKingBaoZha(st, "P0", "P5")).toBeNull()
    expect(g(st, "P5").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)
  })
})

// ==================== 胜利条件边界 ====================

describe("胜利条件 · 屠城互补边界", () => {
  it("屠城：神全灭但平民仍活、狼仍活 → 不判狼胜", () => {
    const st = setup()
    st.winMode = "city"
    ;[3, 4, 5, 6, 7].forEach((i) => (st.players[i].alive = false)) // 神全死
    const r = checkWin(st)
    expect(r.ended).toBe(false)
    expect(st.winCamp).toBeNull()
  })

  it("屠城：狼全灭 → 好人胜（与屠边同口径）", () => {
    const st = setup()
    st.winMode = "city"
    ;[0, 1, 2].forEach((i) => (st.players[i].alive = false))
    const r = checkWin(st)
    expect(r.ended).toBe(true)
    expect(st.winCamp).toBe("god")
    expect(r.text).toBe("好人胜利")
  })
})

describe("胜利条件 · 已结算不重判", () => {
  it("finished 后 checkWin 不再改写既有 winCamp", () => {
    const st = setup()
    st.winCamp = "wolf"
    st.finished = true
    const r = checkWin(st)
    expect(r.ended).toBe(false)
    expect(r.text).toBe("")
    expect(st.winCamp).toBe("wolf") // 提前结算的结论不被刷新
  })
})

// ==================== 修复回归：警徽 / 屠城口径 / 目标校验 ====================

describe("警徽 · 殉情也要触发移交", () => {
  it("警长是殉情的一方 → badgePending 置位（否则移交弹窗永不触发、警徽卡在死人身上）", () => {
    const st = setupQ()
    expect(cupidConnect(st, ["P4", "P8"])).toBeNull() // 预言家 + 平民
    setJingHui(st, "P4", false)
    killPlayer(st, "P8", "wolfKill") // 伴侣被刀 → 警长殉情
    expect(stt(st, "P4")).toBe("死/lover")
    expect(st.badgePending).toBe("P4") // GamePanel 靠它弹移交窗
  })

  it("白天放逐殉情同理；白狼王自己是警长自爆则直接流失、不走 pending", () => {
    const st = setupQ()
    expect(cupidConnect(st, ["P4", "P8"])).toBeNull()
    setJingHui(st, "P4", false)
    finishVote(st, "P8", false) // 放逐伴侣 → 警长殉情
    expect(st.badgePending).toBe("P4")
    // 对照：白狼王（警长）自爆带人 → 警徽自吞，不进 pending
    const st2 = setupQ()
    g(st2, "P0").role = "白狼王"
    setJingHui(st2, "P0", false)
    wolfKingBaoZha(st2, "P0", "P5")
    expect(st2.badgePending).toBe("")
    expect(st2.jingHui).toBe("")
  })
})

describe("胜利条件 · 屠城必须杀光好人", () => {
  it("屠城：神民全灭但丘比特活着 → 不判狼胜；丘比特死后才判", () => {
    const st = setupQ("city")
    ;[4, 5, 6, 8, 9, 10, 11].forEach((i) => (st.players[i].alive = false)) // 神+民全死
    let r = checkWin(st)
    expect(g(st, "P7").alive).toBe(true) // 丘比特（第三方）还活着
    expect(r.ended).toBe(false)
    expect(st.winCamp).toBeNull()
    // 屠城要把好人杀完：丘比特出局 → 狼胜
    killPlayer(st, "P7", "wolfKill")
    r = checkWin(st)
    expect(r.ended).toBe(true)
    expect(st.winCamp).toBe("wolf")
  })

  it("屠边不受丘比特影响：神全灭照判狼胜（屠边按类别屠，丘比特不算神也不算民）", () => {
    const st = setupQ("edge")
    ;[4, 5, 6].forEach((i) => (st.players[i].alive = false)) // 神全死
    const r = checkWin(st)
    expect(r.ended).toBe(true)
    expect(st.winCamp).toBe("wolf")
  })

  it("屠城：翻牌白痴活着 → 不判狼胜；屠边仍按「神全灭」照判", () => {
    const st = setup()
    st.winMode = "city"
    st.players.forEach((p, i) => {
      if (i >= 3 && i !== 7) p.alive = false // 神+民死，白痴 P7 留着
    })
    g(st, "P7").mark.idiotFlipped = true
    let r = checkWin(st)
    expect(g(st, "P7").alive).toBe(true)
    expect(r.ended).toBe(false) // 屠城：活的翻牌白痴＝好人没杀完
    expect(st.winCamp).toBeNull()
    // 同一组存活状态切成屠边：神全灭这条边成立，翻牌白痴不挡
    st.winMode = "edge"
    r = checkWin(st)
    expect(r.ended).toBe(true)
    expect(st.winCamp).toBe("wolf")
  })
})

describe("底层操作 · 目标必须在场且存活", () => {
  it("毒药打已出局者被拦，且毒药不消耗", () => {
    const st = setup()
    g(st, "P8").alive = false
    expect(witchPoison(st, "P8")).toContain("已出局")
    expect(st.witchPoisonUsed).toBe(false)
    expect(st.nightUsedDrug).toBeNull()
    // 未找到的玩家同样被拦
    expect(witchPoison(st, "不存在")).toBe("未找到该玩家")
    expect(st.witchPoisonUsed).toBe(false)
    // 修正目标后仍可正常用毒
    expect(witchPoison(st, "P7")).toBeNull()
    expect(st.witchPoisonUsed).toBe(true)
  })

  it("守卫守已出局者/不存在者被拦，不进入步骤", () => {
    const st = setup()
    g(st, "P8").alive = false
    expect(guardDo(st, "P8", false)).toContain("已出局")
    expect(guardDo(st, "不存在", false)).toBe("未找到该玩家")
    expect(st.nightSteps.guard).toBe(false)
    expect(st.nightGuardTarget).toBe("")
    expect(guardDo(st, "P9", false)).toBeNull()
    expect(st.nightSteps.guard).toBe(true)
  })

  it("狼人刀已出局者/不存在者被拦，不标记步骤完成", () => {
    const st = setup()
    g(st, "P8").alive = false
    expect(wolfKill(st, "P8")).toContain("已出局")
    expect(wolfKill(st, "不存在")).toBe("未找到该玩家")
    expect(st.nightSteps.wolf).toBe(false)
    expect(st.nightWolfKill).toBe("")
    expect(wolfKill(st, "P9")).toBeNull()
    expect(st.nightSteps.wolf).toBe(true)
  })

  it("预言家查验已出局者/不存在者被拦，不写验人结果", () => {
    const st = setup()
    g(st, "P8").alive = false
    expect(prophetCheck(st, "P8")).toContain("已出局")
    expect(prophetCheck(st, "不存在")).toBe("未找到该玩家")
    expect(st.nightSteps.prophet).toBe(false)
    expect(st.prophetReport).toBe("")
    expect(prophetCheck(st, "P0")).toBeTruthy()
    expect(st.nightSteps.prophet).toBe(true)
  })
})
