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
  wolfKingBaoZha,
  resetWholeGame,
  setRole,
  roleQuota,
  manualSaveRoles,
  setBoardRoles,
  getBoardRoles,
  canAddRole,
  applyBoard,
  reorderPlayers,
  setJudge,
  confirmPlayers,
  boardConfig,
  WIN_TEXT,
  NO_CHECK,
  cupidConnect,
  applyLoverDeaths,
  getChainType,
  isLover,
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
    expect(byRole(st, "守卫")!.mark.guardHitCount).toBe(1)
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

  it("女巫毒猎人：下毒时立即标记吞枪（猎人睁眼在女巫之后）", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P0")
    const err = witchPoison(st, "P5") // 猎人
    expect(err).toBeNull()
    expect(g(st, "P5").mark.hunterIsPoisoned).toBe(true)
    expect(g(st, "P5").alive).toBe(true) // 存活但已被标记哑火，睁眼即告知
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

  it("女巫自救：首夜可自救，之后夜晚不能自救", () => {
    const st = setup()
    nextNight(st) // round 1
    wolfKill(st, "P4") // 刀女巫自己
    expect(witchSave(st)).toBeNull() // 首夜自救成功
    const st2 = setup()
    nextNight(st2)
    nextNight(st2) // round 2
    wolfKill(st2, "P4")
    const err = witchSave(st2)
    expect(err).toContain("自救")
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

  it("好人胜利：神职+3 且平民+2（狼全灭同时发分）", () => {
    const st = setup()
    st.winCamp = "god"
    st.players.filter((p) => p.role === "狼人").forEach((p) => (p.alive = false))
    recalcScore(st)
    expect(byRole(st, "预言家")!.scoreRound).toBe(3)
    expect(byRole(st, "平民")!.scoreRound).toBe(2)
    const st2 = setup()
    st2.winCamp = "civil"
    st2.players.filter((p) => p.role !== "平民").forEach((p) => (p.alive = false))
    recalcScore(st2)
    expect(st2.players.find((p) => p.role === "平民")!.scoreRound).toBe(2)
    expect(byRole(st2, "预言家")!.scoreRound).toBe(3)
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

  it("白狼王带猎人：跳过投票，猎人不开枪（被带走无枪）", () => {
    const st = setup()
    const wwk = st.players[0]
    wwk.role = "白狼王"
    const hunter = byRole(st, "猎人")!
    const err = wolfKingBaoZha(st, wwk.name, hunter.name)
    expect(err).toBeNull()
    expect(st.skipVote).toBe(true)
    expect(st.hunterShotPending).toBe(false)
    expect(g(st, hunter.name).alive).toBe(false)
  })

  it("白狼王带走狼王：狼王不开枪", () => {
    const st = setup()
    const wwk = st.players[0]
    wwk.role = "白狼王"
    const wolfKing = st.players[1]
    wolfKing.role = "狼王"
    const err = wolfKingBaoZha(st, wwk.name, wolfKing.name)
    expect(err).toBeNull()
    expect(st.wolfKingShotPending).toBe(false)
    expect(g(st, wolfKing.name).alive).toBe(false)
  })

  it("自爆吞警徽：警长自爆 → 警徽流失", () => {
    const st = setup()
    st.jingHui = "P0"
    wolfBaoZha(st, "P0")
    expect(st.jingHui).toBe("")
    expect(st.skipVote).toBe(true)
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

  it("法官与玩家互斥：设法官移除玩家、法官不可再被添加为玩家", () => {
    const st = defaultState()
    addPlayer(st, "张三")
    addPlayer(st, "李四")
    setJudge(st, "张三")
    expect(st.players.map((p) => p.name)).toEqual(["李四"]) // 法官被移出参与玩家
    const err = addPlayer(st, "张三")
    expect(err).toContain("法官")
    expect(st.players.some((p) => p.name === "张三")).toBe(false)
  })

  it("reorderPlayers 按新顺序整序并重编座位号", () => {
    const st = defaultState()
    ;["A", "B", "C", "D"].forEach((n) => addPlayer(st, n))
    reorderPlayers(st, ["D", "A", "C", "B"])
    expect(st.players.map((p) => p.name)).toEqual(["D", "A", "C", "B"])
    expect(st.players.map((p) => p.no)).toEqual([1, 2, 3, 4])
    // 缺名/多名容错：未出现在新序中的玩家追加到末尾
    reorderPlayers(st, ["B", "A"])
    expect(st.players.map((p) => p.name)).toEqual(["B", "A", "D", "C"])
  })
})

describe("丘比特 / 情侣", () => {
  // 预女猎丘 4狼4民：P0-P3狼人 P4预言家 P5女巫 P6猎人 P7丘比特 P8-P11平民
  function setupQ(): GameState {
    const st = defaultState()
    st.board = "12q"
    st.players = [
      "狼人", "狼人", "狼人", "狼人",
      "预言家", "女巫", "猎人", "丘比特",
      "平民", "平民", "平民", "平民",
    ].map((r, i) => {
      const p = newPlayer("P" + i)
      p.role = r
      return p
    })
    return st
  }

  it("丘比特连人：成功/重复/数量错误/自连(允许)", () => {
    const st = setupQ()
    expect(cupidConnect(st, ["P0", "P8"])).toBeNull()
    expect(st.lovers).toEqual(["P0", "P8"])
    expect(getChainType(st)).toBe("WG")
    expect(cupidConnect(st, ["P1", "P2"])).toContain("不能重复连接")
    expect(cupidConnect(st, ["P3"])).toContain("两位")
    // 自连：丘比特可连自己（丘比特+狼 → 人狼恋第三方；丘比特+好人 → 人人恋）
    const st2 = setupQ()
    expect(cupidConnect(st2, ["P7", "P1"])).toBeNull()
    expect(getChainType(st2)).toBe("WG")
    const st3 = setupQ()
    expect(cupidConnect(st3, ["P7", "P8"])).toBeNull()
    expect(getChainType(st3)).toBe("GG")
  })

  it("链型判定：GG/WW/WG/未确认", () => {
    const st = setupQ()
    expect(getChainType(st)).toBe("")
    cupidConnect(st, ["P0", "P8"])
    expect(getChainType(st)).toBe("WG")
    const st2 = setupQ()
    cupidConnect(st2, ["P0", "P1"])
    expect(getChainType(st2)).toBe("WW")
    const st3 = setupQ()
    cupidConnect(st3, ["P8", "P9"])
    expect(getChainType(st3)).toBe("GG")
    const st4 = setupQ()
    g(st4, "P8").role = ""
    cupidConnect(st4, ["P0", "P8"])
    expect(getChainType(st4)).toBe("")
  })

  it("殉情：被刀后伴侣立刻出局", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 人狼恋 P0狼恋人 P8好人恋人
    nextNight(st)
    wolfKill(st, "P8") // 狼刀好人恋人
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
    expect(g(st, "P0").alive).toBe(false) // 狼恋人殉情
    expect(st.globalLog.some((l) => l.includes("殉情"))).toBe(true)
  })

  it("殉情：被毒后伴侣立刻出局", () => {
    const st = setupQ()
    cupidConnect(st, ["P8", "P9"]) // 人人恋
    nextNight(st)
    wolfKill(st, "P5")
    st.witchPoisonUsed = true
    st.nightUsedDrug = "poison"
    st.nightWitchPoison = "P8"
    st.nightSteps.witch = true
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
    expect(g(st, "P9").alive).toBe(false)
  })

  it("殉情：被放逐后伴侣出局", () => {
    const st = setupQ()
    cupidConnect(st, ["P10", "P11"])
    finishVote(st, "P10", false)
    expect(g(st, "P10").alive).toBe(false)
    expect(g(st, "P11").alive).toBe(false)
  })

  it("殉情：猎人被放逐可开枪，但殉情的猎人不触发开枪", () => {
    const st = setupQ()
    cupidConnect(st, ["P10", "P6"]) // 平民恋人+猎人恋人
    finishVote(st, "P10", false) // 平民先出局 → 猎人殉情
    expect(g(st, "P6").alive).toBe(false)
    expect(st.hunterShotPending).toBe(false)

    const st2 = setupQ()
    cupidConnect(st2, ["P6", "P8"]) // 猎人先出局
    finishVote(st2, "P6", false)
    expect(g(st2, "P6").alive).toBe(false)
    expect(st2.hunterShotPending).toBe(true) // 猎人主动出局可开枪
    expect(g(st2, "P8").alive).toBe(false) // 平民殉情
  })

  it("殉情：狼王被刀可开枪，殉情的狼王不可", () => {
    const st2 = setupQ()
    g(st2, "P7").role = "狼王"
    st2.lovers = ["P10", "P7"] // 直接设恋人（狼王没有专属板，绕过丘比特）
    finishVote(st2, "P7", false)
    expect(g(st2, "P7").alive).toBe(false)
    expect(st2.wolfKingShotPending).toBe(true)
    expect(g(st2, "P10").alive).toBe(false)
  })

  it("互刀限制：狼恋人不能作为刀人目标", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // P0 狼恋人
    nextNight(st)
    const err = wolfKill(st, "P0")
    expect(err).toContain("互刀")
    expect(wolfKill(st, "P8")).toBeNull() // 好人恋人可以被刀
  })

  it("第三方胜：只剩丘比特+情侣时直接获胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 人狼恋
    st.round = 3
    st.phase = "day"
    // 丘比特 P7 + 恋人 P0 P8 存活；其余全死
    st.players.forEach((p) => {
      if (!["P7", "P0", "P8"].includes(p.name)) p.alive = false
    })
    const r = checkWin(st)
    expect(r.ended).toBe(true)
    expect(st.winCamp).toBe("third")
    expect(r.text).toBe(WIN_TEXT.third)
  })

  it("人狼恋：只杀光单身狼不算好人赢（第三方情侣还在）", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 人狼恋，P0狼恋人 P8好人恋人
    st.round = 3
    st.phase = "day"
    ;["P1", "P2", "P3"].forEach((n) => (g(st, n).alive = false)) // 单身狼死光
    checkWin(st)
    expect(st.winCamp).toBeNull() // 好人不能赢，第三方 P0/P8 还在
  })

  it("人狼恋：只达成屠边不算狼赢（第三方情侣还在）", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"])
    st.round = 3
    st.phase = "day"
    ;["P4", "P5", "P6"].forEach((n) => (g(st, n).alive = false)) // 屠神，但丘比特 P7 不算神
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })

  it("人狼恋：丘比特死但情侣存活 → 第三方保留，好/狼不判胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"])
    st.round = 3
    st.phase = "day"
    g(st, "P7").alive = false // 丘比特死
    ;["P1", "P2", "P3"].forEach((n) => (g(st, n).alive = false))
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })

  it("人狼恋：情侣双死但丘比特存活 → 第三方保留，好/狼均不判胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"])
    st.round = 3
    st.phase = "day"
    ;["P0", "P8", "P1", "P2", "P3"].forEach((n) => (g(st, n).alive = false)) // 情侣+所有狼死，丘比特 P7 活
    const r = checkWin(st)
    expect(st.winCamp).toBeNull()
    expect(r.reason).not.toContain("好人")
    // 丘比特也出局 → 第三方解散，好人胜
    g(st, "P7").alive = false
    checkWin(st)
    expect(st.winCamp).toBe("god")
  })

  it("人狼恋：情侣双死且屠边但丘比特存活 → 狼不判胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"])
    st.round = 3
    st.phase = "day"
    // 情侣 + 神 + 民 全部出局，只剩狼 P1 与丘比特 P7
    ;["P0", "P8", "P4", "P5", "P6", "P9", "P10", "P11"].forEach((n) => (g(st, n).alive = false))
    checkWin(st)
    expect(st.winCamp).toBeNull()
    // 丘比特也出局 → 狼胜
    g(st, "P7").alive = false
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("屠边不含丘比特：丘比特活着也算屠神成功", () => {
    const st = setupQ()
    cupidConnect(st, ["P8", "P9"]) // 人人恋，丘比特属好人但不计神
    st.round = 2
    st.phase = "day"
    ;["P4", "P5", "P6"].forEach((n) => (g(st, n).alive = false)) // 预女猎死光
    ;["P8", "P9"].forEach((n) => (g(st, n).alive = false)) // 情侣已死（无第三方影响）
    checkWin(st)
    expect(st.winCamp).toBe("wolf") // 屠神成功（丘比特活着也不算神）
  })

  it("第三方算分：丘比特+情侣各+3", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"])
    st.winCamp = "third"
    recalcScore(st)
    expect(g(st, "P7").scoreRound).toBe(3)
    expect(g(st, "P0").scoreRound).toBe(3)
    expect(g(st, "P8").scoreRound).toBe(3)
    expect(g(st, "P1").scoreRound).toBe(0)
  })

  it("好人胜利时丘比特+3", () => {
    const st = setupQ()
    st.winCamp = "god"
    recalcScore(st)
    expect(g(st, "P7").scoreRound).toBe(3)
  })

  it("狼狼恋：无第三方，丘比特属好人（好人胜+3，狼胜不给丘比特+3）", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P1"]) // 狼狼恋
    st.winCamp = "god"
    recalcScore(st)
    expect(g(st, "P7").scoreRound).toBe(3)
    const st2 = setupQ()
    cupidConnect(st2, ["P0", "P1"])
    st2.winCamp = "wolf"
    recalcScore(st2)
    expect(g(st2, "P7").scoreRound).toBe(0)
  })

  it("人狼恋：2平民+丘比特 → 不判平局（平民票数足够放逐第三方）", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 人狼恋，P0狼恋人 P8好人恋人，丘比特 P7
    st.round = 3
    st.phase = "day"
    ;["P0", "P8", "P1", "P2", "P3", "P4", "P5", "P6", "P9"].forEach((n) => (g(st, n).alive = false))
    // 存活：P7 丘比特 + P10 P11 两个平民
    checkWin(st)
    expect(st.winCamp).toBeNull() // 平民 2 票 > 第三方 1 人，可投出第三方 → 不判平局
  })

  it("人狼恋：1平民+丘比特 → 平局（平民票数与第三方持平，僵局）", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 人狼恋，丘比特 P7
    st.round = 3
    st.phase = "day"
    ;["P0", "P8", "P1", "P2", "P3", "P4", "P5", "P6", "P9", "P10"].forEach((n) => (g(st, n).alive = false))
    // 存活：P7 丘比特 + P11 一个平民
    checkWin(st)
    expect(st.winCamp).toBe("draw")
  })

  it("人狼恋常驻：丘比特死但好人恋人活+狼全灭 → 不判好人胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // P0狼恋人 P8好人恋人，丘比特 P7
    st.round = 3
    st.phase = "day"
    // 丘比特死 + 狼恋人死 + 单身狼全死，仅好人恋人 P8 存活（第三方还在）
    ;["P7", "P0", "P1", "P2", "P3"].forEach((n) => (g(st, n).alive = false))
    checkWin(st)
    expect(st.winCamp).toBeNull()
  })

  it("人狼恋常驻：三方成员全灭+狼全灭 → 好人胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // 丘比特 P7，恋人 P0/P8
    st.round = 3
    st.phase = "day"
    ;["P7", "P0", "P8", "P1", "P2", "P3"].forEach((n) => (g(st, n).alive = false))
    checkWin(st)
    expect(st.winCamp).toBe("god")
  })

  it("人狼恋常驻：丘比特死但狼恋人活（第三方保留）→ 狼屠边也不判狼胜", () => {
    const st = setupQ()
    cupidConnect(st, ["P0", "P8"]) // P0狼恋人 P8好人恋人
    st.round = 3
    st.phase = "day"
    // 丘比特 P7 死；神全灭；仅剩狼恋人 P0 + 好人恋人 P8 + 平民
    ;["P7", "P4", "P5", "P6", "P9", "P10", "P11"].forEach((n) => (g(st, n).alive = false))
    checkWin(st)
    expect(st.winCamp).toBeNull() // 第三方存在，狼胜不成立
  })
})
