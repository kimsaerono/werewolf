import { describe, it, expect } from "bun:test"
import {
  defaultState,
  normalizeState,
  newPlayer,
  addPlayer,
  nextNight,
  resolveNightDeath,
  recalcScore,
  checkWin,
  finishGameAuto,
  wolfKill,
  prophetCheck,
  witchSave,
  witchPoison,
  guardDo,
  finishVote,
  wolfBaoZha,
  resetWholeGame,
  setRole,
  roleQuota,
  manualSaveRoles,
  setBoardRoles,
  getBoardRoles,
  canAddRole,
  applyBoard,
  setJudge,
  confirmPlayers,
  boardConfig,
  WIN_TEXT,
  NO_CHECK,
  type GameState,
  type Player,
} from "./logic"

function makePlayers(roles: string[]): Player[] {
  return roles.map((r, i) => {
    const p = newPlayer("P" + i)
    p.role = r
    return p
  })
}

function setup(roles?: string[]): GameState {
  const st = defaultState()
  st.players = makePlayers(
    roles ?? ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "平民"],
  )
  return st
}
function g(st: GameState, name: string): Player {
  const p = st.players.find((x) => x.name === name)
  if (!p) throw new Error("not found " + name)
  return p
}
function byRole(st: GameState, role: string): Player | undefined {
  return st.players.find((p) => p.role === role)
}
function started(st: GameState): GameState {
  st.phase = "day"
  st.round = 1
  return st
}

describe("夜晚结算", () => {
  it("女巫救人对目标免死 + 平安夜", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P6") // 守卫
    witchSave(st)
    resolveNightDeath(st)
    expect(g(st, "P6").alive).toBe(true)
    expect(st.globalLog.some((l) => l.includes("平安夜"))).toBe(true)
  })

  it("守卫守中挡刀 + 守中标记", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    guardDo(st, "P8", false)
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(true)
    expect(byRole(st, "守卫")!.mark.guardHit).toBe(true)
  })

  it("毒药无视守卫", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P7") // 白痴
    guardDo(st, "P7", false)
    // 女巫毒 P7
    const w = byRole(st, "女巫")!
    w.alive = true
    st.witchPoisonUsed = true
    st.nightUsedDrug = "poison"
    st.nightWitchPoison = "P7"
    st.nightSteps.witch = true
    resolveNightDeath(st)
    expect(g(st, "P7").alive).toBe(false)
  })

  it("同守同救被刀目标死亡", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    guardDo(st, "P8", true)
    witchSave(st)
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
    expect(byRole(st, "守卫")!.mark.guardSameSaveKill).toBe(true)
  })

  it("狼人刀人未完成时天亮被拦", () => {
    const st = setup()
    nextNight(st)
    resolveNightDeath(st)
    expect(st.phase).toBe("night")
  })

  it("非夜晚不能天亮", () => {
    const st = setup()
    resolveNightDeath(st)
    expect(st.phase).toBe("idle")
  })

  it("猎人被刀可开枪，被毒不可", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P5") // 猎人
    resolveNightDeath(st)
    expect(g(st, "P5").alive).toBe(false)
    expect(st.hunterShotPending).toBe(true)
    expect(g(st, "P5").mark.hunterIsPoisoned).toBe(false)

    const st2 = setup()
    nextNight(st2)
    wolfKill(st2, "P5")
    st2.witchPoisonUsed = true
    st2.nightUsedDrug = "poison"
    st2.nightWitchPoison = "P5"
    st2.nightSteps.witch = true
    resolveNightDeath(st2)
    expect(st2.hunterShotPending).toBe(false)
    expect(g(st2, "P5").mark.hunterIsPoisoned).toBe(true)
  })

  it("守卫连守限制", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    guardDo(st, "P8", false)
    resolveNightDeath(st)
    expect(st.guardLastTarget).toBe("P8")
    const err = guardDo(st, "P8", false)
    expect(err).toContain("不能连续两晚守同一人")
  })
})

describe("预言家/狼人/女巫标记", () => {
  it("选中狼人即自刀", () => {
    const st = setup()
    wolfKill(st, "P0")
    expect(st.wolfSelfKill).toBe(true)
  })

  it("刀人再次选择=切换，只生效一个目标", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    wolfKill(st, "P7")
    expect(st.nightWolfKill).toBe("P7")
    expect(st.globalLog.some((l) => l.includes("目标切换"))).toBe(true)
    // 天亮只死最终目标 P7（无人救/守）
    resolveNightDeath(st)
    expect(g(st, "P7").alive).toBe(false)
    expect(g(st, "P8").alive).toBe(true)
  })

  it("重复点击同一刀人目标不重复记录", () => {
    const st = setup()
    wolfKill(st, "P8")
    const logs = st.globalLog.length
    wolfKill(st, "P8")
    expect(st.globalLog.length).toBe(logs)
  })

  it("首夜验狼标记", () => {
    const st = setup()
    st.round = 1
    const r = prophetCheck(st, "P0")
    expect(r).toEqual({ name: "P0", isWolf: true })
    expect(byRole(st, "预言家")!.mark.prophetFirstDayWolf).toBe(true)
  })

  it("预言家不验选项", () => {
    const st = setup()
    prophetCheck(st, NO_CHECK)
    expect(byRole(st, "预言家")!.mark.prophetNoCheckCount).toBe(1)
  })

  it("自刀骗解药标记", () => {
    const st = setup()
    st.wolfSelfKill = true
    st.nightWolfKill = "P0"
    witchSave(st)
    expect(g(st, "P0").mark.wolfSelfKillCheat).toBe(true)
  })

  it("未刀人时不能使用解药", () => {
    const st = setup()
    const err = witchSave(st)
    expect(err).toContain("没有狼人刀人记录")
  })

  it("一晚只能一瓶药", () => {
    const st = setup()
    st.nightWolfKill = "P8"
    witchSave(st)
    const err = witchPoison(st, "P0")
    expect(err).toContain("不能同时使用解药和毒药")
  })
})

describe("算分引擎", () => {
  it("预言家首夜验狼+警徽=1.0", () => {
    const st = setup()
    g(st, "P3").mark.prophetFirstDayWolf = true
    st.jingHui = "P3"
    recalcScore(st)
    expect(g(st, "P3").scoreRound).toBe(1)
  })

  it("女巫毒狼+1 猎人带狼+1", () => {
    const st = setup()
    byRole(st, "女巫")!.mark.witchPoWolf = true
    byRole(st, "猎人")!.mark.hunterKillWolf = true
    recalcScore(st)
    expect(byRole(st, "女巫")!.scoreRound).toBe(1)
    expect(byRole(st, "猎人")!.scoreRound).toBe(1)
  })

  it("不再统计逐人投票分（v22）", () => {
    const st = setup()
    const civ = st.players.find((p) => p.role === "平民")!
    civ.mark.voteWolfCount = 5
    civ.mark.voteGoodCount = 1
    recalcScore(st)
    expect(civ.scoreRound).toBe(0)
  })

  it("白痴翻牌无投票分影响", () => {
    const st = setup()
    const idiot = byRole(st, "白痴")!
    idiot.mark.idiotFlipped = true
    idiot.mark.voteWolfCount = 1
    recalcScore(st)
    expect(idiot.scoreRound).toBe(0)
  })

  it("狼人胜利+3 3狼存活+0.5", () => {
    const st = setup()
    st.winCamp = "wolf"
    st.players.filter((p) => p.role !== "狼人").forEach((p) => (p.alive = false))
    recalcScore(st)
    expect(g(st, "P0").scoreRound).toBe(3.5)
  })

  it("神职胜利+3 / 平民胜利+2", () => {
    const st = setup()
    st.winCamp = "god"
    st.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    recalcScore(st)
    expect(byRole(st, "预言家")!.scoreRound).toBe(3)
    const st2 = setup()
    st2.winCamp = "civil"
    st2.players.filter((p) => p.role !== "平民").forEach((p) => (p.alive = false))
    recalcScore(st2)
    expect(st2.players.find((p) => p.role === "平民")!.scoreRound).toBe(2)
  })

  it("MVP/SVP/背锅侠", () => {
    const st = setup()
    st.mvp = "P3"
    st.svp = "P4"
    st.beiguo = "P0"
    recalcScore(st)
    expect(g(st, "P3").scoreRound).toBe(1)
    expect(g(st, "P4").scoreRound).toBe(0.5)
    expect(g(st, "P0").scoreRound).toBe(-0.5)
  })
})

describe("胜负判定", () => {
  it("空对局不误判", () => {
    const st = defaultState()
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })

  it("有玩家但未分配角色不误判（进入夜晚不弹平民胜利）", () => {
    const st = defaultState()
    st.players = [newPlayer("A"), newPlayer("B")]
    st.phase = "night"
    st.round = 1
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })

  it("狼全灭判神职胜且只弹一次", () => {
    const st = started(setup())
    checkWin(st)
    expect(st.winCamp).toBeNull()
    ;["P0", "P1", "P2"].forEach((n) => (g(st, n).alive = false))
    const r1 = checkWin(st)
    expect(r1.ended).toBe(true)
    expect(st.winCamp).toBe("god")
    const r2 = checkWin(st)
    expect(r2.ended).toBe(false)
  })

  it("好人全灭判狼胜", () => {
    const st = started(setup())
    st.players.forEach((p) => {
      if (p.role !== "狼人") p.alive = false
    })
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("白痴翻牌后不计神职存活 → 屠神判狼胜", () => {
    const st = started(setup())
    ;["预言家", "女巫", "猎人", "守卫"].forEach((r) => {
      st.players.find((p) => p.role === r)!.alive = false
    })
    const idiot = byRole(st, "白痴")!
    idiot.mark.idiotFlipped = true
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("白痴未翻牌仍算神职 → 不判胜", () => {
    const st = started(setup())
    ;["预言家", "女巫", "猎人", "守卫"].forEach((r) => {
      st.players.find((p) => p.role === r)!.alive = false
    })
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })
})

describe("放逐/自爆", () => {
  it("白痴翻牌免死", () => {
    const st = setup()
    finishVote(st, "P7", true)
    expect(g(st, "P7").alive).toBe(true)
    expect(g(st, "P7").mark.idiotFlipped).toBe(true)
  })

  it("猎人被放逐可开枪", () => {
    const st = setup()
    finishVote(st, "P5", false)
    expect(g(st, "P5").alive).toBe(false)
    expect(st.hunterShotPending).toBe(true)
  })

  it("狼人自爆跳过投票", () => {
    const st = setup()
    wolfBaoZha(st, "P0")
    expect(g(st, "P0").alive).toBe(false)
    expect(st.skipVote).toBe(true)
  })

  it("自爆后投票被拦", () => {
    const st = setup()
    wolfBaoZha(st, "P0")
    const err = finishVote(st, "P8", false)
    expect(err).toContain("跳过投票")
  })
})

describe("结算", () => {
  it("一键结算固化总分", () => {
    const st = setup()
    st.winCamp = "wolf"
    st.players.forEach((p) => {
      if (p.role === "狼人") p.scoreTotal = 10
    })
    st.players.filter((p) => p.role !== "狼人").forEach((p) => (p.alive = false))
    const err = finishGameAuto(st)
    expect(err).toBeNull()
    expect(g(st, "P0").scoreTotal).toBe(13.5)
    expect(st.finished).toBe(true)
    expect(finishGameAuto(st)).toContain("重复")
  })
})

describe("玩家管理", () => {
  it("添加/去重/上限", () => {
    const st = defaultState()
    expect(addPlayer(st, " 张三 ")).toBeNull()
    expect(st.players[0].name).toBe("张三")
    expect(addPlayer(st, "张三")).toContain("已签到")
    expect(addPlayer(st, "")).toContain("请输入")
  })

  it("带编号签到：自动/指定/去重", () => {
    const st = defaultState()
    expect(addPlayer(st, "A")).toBeNull()
    expect(st.players[0].no).toBe(1)
    expect(addPlayer(st, "B", 5)).toBeNull()
    expect(st.players[1].no).toBe(5)
    expect(addPlayer(st, "C", 5)).toContain("占用")
    expect(addPlayer(st, "D", 0)).toContain("≥ 1")
  })

  it("重置保留板子", () => {
    const st = setup()
    st.board = "12"
    const s2 = resetWholeGame(st)
    expect(s2.board).toBe("12")
    expect(s2.players.length).toBe(0)
  })

  it("normalizeState 兼容旧数据", () => {
    const st = normalizeState({ board: "8b", players: [{ name: "A", role: "狼人", alive: true }] } as unknown as GameState)
    expect(st.players[0].scoreRound).toBe(0)
    expect(st.players[0].mark.prophetNoCheckCount).toBe(0)
  })
})

describe("角色配额", () => {
  it("6a 板配额：2狼1预言1猎2平民", () => {
    const st = defaultState()
    st.board = "6a"
    expect(roleQuota(st)).toEqual({ 狼人: 2, 预言家: 1, 猎人: 1, 平民: 2 })
  })

  it("预言家不能分配给两个人", () => {
    const st = defaultState()
    st.board = "6a"
    st.players = [newPlayer("A"), newPlayer("B")]
    expect(setRole(st, 0, "预言家")).toBeNull()
    const err = setRole(st, 1, "预言家")
    expect(err).toContain("已满")
    expect(st.players[1].role).toBe("")
  })

  it("本板子没有的角色不能分配", () => {
    const st = defaultState()
    st.board = "6a"
    st.players = [newPlayer("A")]
    const err = setRole(st, 0, "女巫")
    expect(err).toContain("没有")
  })

  it("开始游戏校验完整阵容", () => {
    const st = defaultState()
    st.board = "6a"
    st.players = ["狼人", "狼人", "预言家", "猎人", "平民", "平民"].map((r) => {
      const p = newPlayer("P" + Math.random())
      p.role = r
      return p
    })
    expect(manualSaveRoles(st)).toBeNull()

    // 预言家重复 -> 校验失败
    const st2 = defaultState()
    st2.board = "6a"
    st2.players = ["狼人", "狼人", "预言家", "预言家", "平民", "平民"].map((r) => {
      const p = newPlayer("P" + Math.random())
      p.role = r
      return p
    })
    expect(manualSaveRoles(st2)).toContain("预言家")
  })

  it("自定义板子：加角色后配额变化", () => {
    const st = defaultState()
    st.board = "6a"
    expect(setBoardRoles(st, ["狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民"])).toBeNull()
    expect(getBoardRoles(st).length).toBe(8)
    expect(roleQuota(st).守卫).toBe(1)
    expect(roleQuota(st).女巫).toBe(1)
  })

  it("自定义板子校验：必须有狼人和好人", () => {
    const st = defaultState()
    expect(setBoardRoles(st, ["狼人", "狼人"])).toContain("好人")
    expect(setBoardRoles(st, ["预言家", "平民"])).toContain("狼人")
    expect(setBoardRoles(st, ["狼人"])).toContain("至少")
  })

  it("切换板子重置自定义角色", () => {
    const st = defaultState()
    setBoardRoles(st, ["狼人", "狼人", "预言家", "猎人", "平民"])
    applyBoard(st, "12")
    expect(st.boardRoles).toBeNull()
    expect(getBoardRoles(st)).toEqual(boardConfig["12"])
  })

  it("唯一性角色不能重复加（预言家/女巫等最多1个）", () => {
    const st = defaultState()
    st.board = "6a"
    expect(setBoardRoles(st, ["狼人", "狼人", "预言家", "预言家", "平民", "平民"])).toContain("预言家")
    expect(setBoardRoles(st, ["狼人", "狼人", "女巫", "女巫", "平民", "平民"])).toContain("女巫")
    // 狼人可以多个，平民可以多个
    expect(setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "平民", "平民", "平民"])).toBeNull()
  })

  it("canAddRole：唯一性角色已有则不可加", () => {
    expect(canAddRole(["狼人", "预言家"], "预言家")).toBe(false)
    expect(canAddRole(["狼人", "预言家"], "女巫")).toBe(true)
    expect(canAddRole(["狼人"], "狼人")).toBe(true)
    expect(canAddRole(["狼人", "平民"], "平民")).toBe(true)
  })

  it("法官设置与参与确认", () => {
    const st = defaultState()
    setJudge(st, "柴秀彬")
    expect(st.judge).toBe("柴秀彬")
    confirmPlayers(st)
    expect(st.playersConfirmed).toBe(true)
    expect(st.globalLog.some((l) => l.includes("确认"))).toBe(true)
  })
})
