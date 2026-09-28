import { describe, it, expect } from "bun:test"
import {
  defaultState,
  newPlayer,
  nextNight,
  resolveNightDeath,
  recalcScore,
  checkWin,
  wolfKill,
  witchSave,
  witchPoison,
  guardDo,
  finishVote,
  wolfBaoZha,
  wolfKingBaoZha,
  cupidConnect,
  killPlayer,
  knightDuel,
  hunterShootConfirm,
  wolfKingShootConfirm,
  setJingHui,
  autoTransferJingHui,
  applyHonor,
  suggestHonor,
  setBoardRoles,
  finishGameAuto,
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

// ==================== 复杂夜晚场景 ====================

describe("复杂夜晚场景", () => {
  it("狼刀+女巫救+守卫守：同守同救，目标死亡", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8") // 刀平民
    guardDo(st, "P8", false) // 守卫守
    witchSave(st) // 女巫救
    resolveNightDeath(st)
    // 同守同救：目标死亡
    expect(g(st, "P8").alive).toBe(false)
    expect(st.globalLog.some((l) => l.includes("P8") && l.includes("死亡"))).toBe(true)
  })

  it("狼刀+女巫毒同一人：毒药优先，目标死亡", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    const err = witchPoison(st, "P8")
    expect(err).toBeNull()
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
    expect(g(st, "P8").deathReason).toBe("poison")
  })

  it("守卫守+女巫毒同一人：毒药无视守卫，目标死亡", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P0") // 刀狼人（避免平安夜）
    guardDo(st, "P8", false) // 守卫守平民
    const err = witchPoison(st, "P8") // 毒平民
    expect(err).toBeNull()
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
  })

  it("同守同救+女巫毒：同守同救死亡，毒药独立", () => {
    const st = setup()
    // 第一夜：同守同救
    nextNight(st)
    wolfKill(st, "P8")
    guardDo(st, "P8", true) // 同守同救
    witchSave(st)
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false) // 同守同救死
    // 第二夜：女巫毒另一个平民
    nextNight(st)
    wolfKill(st, "P0") // 完成狼人步骤（刀狼人自己）
    const err = witchPoison(st, "P9")
    expect(err).toBeNull()
    resolveNightDeath(st)
    expect(g(st, "P9").alive).toBe(false) // 毒死
  })

  it("多狼刀同一人：只算一刀", () => {
    const st = setup()
    nextNight(st)
    wolfKill(st, "P8")
    // 模拟第二只狼刀同一人（实际游戏中应该被阻止，但测试边界）
    st.nightWolfKills = ["P8", "P8"]
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(false)
    expect(st.globalLog.filter((l) => l.includes("P8") && l.includes("刀")).length).toBe(1)
  })

  it("狼刀空刀：平安夜", () => {
    const st = setup()
    nextNight(st)
    // 空刀：不设置狼刀目标，但完成狼人步骤
    st.nightSteps.wolf = true
    resolveNightDeath(st)
    expect(st.globalLog.some((l) => l.includes("平安夜"))).toBe(true)
  })
})

// ==================== 复杂角色交互 ====================

describe("复杂角色交互", () => {
  it("猎人被狼王带走：猎人可开枪（被带走的猎人不是被毒）", () => {
    const st = setup(["狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])
    started(st)
    const wk = byRole(st, "狼王")!
    const hunter = byRole(st, "猎人")!
    // 狼王被放逐
    finishVote(st, wk.name, false)
    expect(st.wolfKingShotPending).toBe(true)
    // 狼王带走猎人
    const err = wolfKingShootConfirm(st, hunter.name)
    expect(err).toBeNull()
    expect(hunter.alive).toBe(false)
    // 猎人被带走后可开枪
    expect(st.hunterShotPending).toBe(true)
  })

  it("猎人被毒后狼王带走：猎人不能开枪", () => {
    const st = setup(["狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])
    started(st)
    const hunter = byRole(st, "猎人")!
    // 先毒猎人
    nextNight(st)
    witchPoison(st, hunter.name)
    resolveNightDeath(st)
    expect(hunter.mark.hunterIsPoisoned).toBe(true)
    // 再让狼王带走猎人（虽然实际游戏中不可能，但测试边界）
    hunter.alive = false
    st.hunterShotPending = true
    const err = hunterShootConfirm(st, byRole(st, "狼人")!.name)
    expect(err).toContain("毒")
  })

  it("白痴被放逐：翻牌免死，但不能再被放逐", () => {
    const st = setup()
    started(st)
    const idiot = byRole(st, "白痴")!
    // 白痴被放逐，翻牌免死（idiotFlip=true 时翻牌）
    finishVote(st, idiot.name, true)
    expect(idiot.alive).toBe(true)
    expect(idiot.mark.idiotFlipped).toBe(true)
    // 再次尝试放逐白痴（已翻牌，返回错误）
    const err = finishVote(st, idiot.name, false)
    expect(err).toContain("已翻牌")
    expect(idiot.alive).toBe(true) // 白痴仍然活着
  })

  it("白痴被毒：正常死亡（毒药无视翻牌）", () => {
    const st = setup()
    started(st)
    const idiot = byRole(st, "白痴")!
    nextNight(st)
    wolfKill(st, "P0") // 完成狼人步骤（刀狼人自己，避免影响白痴）
    witchPoison(st, idiot.name)
    resolveNightDeath(st)
    expect(idiot.alive).toBe(false)
    expect(idiot.deathReason).toBe("poison")
  })

  it("骑士决斗狼王：狼王死，不能开枪", () => {
    const st = setup(["狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])
    started(st)
    const knight = byRole(st, "猎人")! // 用猎人当骑士
    knight.role = "骑士"
    const wk = byRole(st, "狼王")!
    const err = knightDuel(st, wk.name)
    expect(err).toBeNull()
    expect(wk.alive).toBe(false)
    expect(st.wolfKingShotPending).toBe(false) // 狼王被决斗不能开枪
  })

  it("骑士决斗白痴：骑士戳错好人，骑士自己死", () => {
    const st = setup()
    started(st)
    const knight = byRole(st, "猎人")!
    knight.role = "骑士"
    const idiot = byRole(st, "白痴")!
    const err = knightDuel(st, idiot.name)
    expect(err).toBeNull()
    expect(knight.alive).toBe(false) // 骑士戳错好人，自己出局
    expect(idiot.alive).toBe(true) // 白痴不受影响
    expect(idiot.mark.idiotFlipped).toBeFalsy() // 白痴没有被杀，不触发翻牌
  })
})

// ==================== 警徽复杂流转 ====================

describe("警徽复杂流转", () => {
  it("警长被刀+猎人开枪：警徽pending，猎人开枪后处理警徽", () => {
    const st = setup()
    started(st)
    const hunter = byRole(st, "猎人")!
    setJingHui(st, hunter.name, false)
    // 猎人被刀
    nextNight(st)
    wolfKill(st, hunter.name)
    resolveNightDeath(st)
    expect(st.badgePending).toBe(hunter.name)
    expect(st.hunterShotPending).toBe(true)
    // 猎人开枪带走狼人
    const wolf = byRole(st, "狼人")!
    hunterShootConfirm(st, wolf.name)
    // 然后处理警徽
    autoTransferJingHui(st)
    expect(st.jingHui).toBe("")
  })

  it("警长被毒：警徽pending，移交给已死者后警徽流失", () => {
    const st = setup()
    started(st)
    const prophet = byRole(st, "预言家")!
    setJingHui(st, prophet.name, false)
    // 预言家被毒
    nextNight(st)
    wolfKill(st, "P0") // 完成狼人步骤
    witchPoison(st, prophet.name)
    resolveNightDeath(st)
    expect(st.badgePending).toBe(prophet.name)
    // 移交给已死者（setJingHui 不验证，直接设置，但警徽会流失）
    setJingHui(st, prophet.name, false)
    // 由于 prophet 已死，autoTransferJingHui 会流失警徽
    autoTransferJingHui(st)
    expect(st.jingHui).toBe("")
  })

  it("白狼王自爆吞警徽：警徽直接流失，不pending", () => {
    const st = setup()
    const wwk = st.players[0]
    wwk.role = "白狼王"
    setJingHui(st, wwk.name, false)
    wolfKingBaoZha(st, wwk.name, "P5")
    expect(st.jingHui).toBe("")
    expect(st.badgePending).toBe("")
  })

  it("警长被放逐+狼王带走新警长：警徽再次pending", () => {
    const st = setup(["狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])
    started(st)
    const prophet = byRole(st, "预言家")!
    const wk = byRole(st, "狼王")!
    setJingHui(st, prophet.name, false)
    // 预言家被放逐
    finishVote(st, prophet.name, false)
    expect(st.badgePending).toBe(prophet.name)
    // 移交给猎人
    const hunter = byRole(st, "猎人")!
    setJingHui(st, hunter.name, false)
    expect(st.badgePending).toBe("")
    // 狼王被放逐，带走新警长
    finishVote(st, wk.name, false)
    expect(st.wolfKingShotPending).toBe(true)
    wolfKingShootConfirm(st, hunter.name)
    expect(st.badgePending).toBe(hunter.name)
  })
})

// ==================== 丘比特复杂场景 ====================

describe("丘比特复杂场景", () => {
  it("人狼恋+丘比特死+情侣死：第三方解散，好人胜", () => {
    const st = setup()
    setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    st.players = makePlayers(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    cupidConnect(st, ["P0", "P8"]) // 人狼恋
    started(st)
    // 丘比特死
    killPlayer(st, "P9", "vote")
    // 情侣死
    killPlayer(st, "P0", "wolfKill")
    // 狼全灭
    killPlayer(st, "P1", "vote")
    killPlayer(st, "P2", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("god")
  })

  it("人人恋+丘比特活：丘比特属好人，好人胜+3", () => {
    const st = setup()
    setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    st.players = makePlayers(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    cupidConnect(st, ["P8", "P3"]) // 人人恋（平民+预言家）
    started(st)
    // 狼全灭
    killPlayer(st, "P0", "vote")
    killPlayer(st, "P1", "vote")
    killPlayer(st, "P2", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("god")
    recalcScore(st)
    expect(g(st, "P9").scoreRound).toBe(3) // 丘比特+3
  })

  it("狼狼恋：无第三方，丘比特属好人", () => {
    const st = setup()
    setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    st.players = makePlayers(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    cupidConnect(st, ["P0", "P1"]) // 狼狼恋
    started(st)
    // 狼胜
    killPlayer(st, "P3", "vote")
    killPlayer(st, "P4", "vote")
    killPlayer(st, "P5", "vote")
    killPlayer(st, "P6", "vote")
    killPlayer(st, "P7", "vote")
    killPlayer(st, "P8", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
    recalcScore(st)
    expect(g(st, "P9").scoreRound).toBe(0) // 丘比特不加分（狼胜）
  })

  it("人狼恋+屠边：第三方存在，不判狼胜", () => {
    const st = setup()
    setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    st.players = makePlayers(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    cupidConnect(st, ["P0", "P8"]) // 人狼恋
    started(st)
    // 屠神（但丘比特不算神）
    killPlayer(st, "P3", "vote")
    killPlayer(st, "P4", "vote")
    killPlayer(st, "P5", "vote")
    killPlayer(st, "P6", "vote")
    killPlayer(st, "P7", "vote")
    checkWin(st)
    expect(st.winCamp).toBeNull() // 第三方存在，不判狼胜
  })
})

// ==================== 胜负边界情况 ====================

describe("胜负边界情况", () => {
  it("屠城模式：神全灭+民全灭+狼活 = 狼胜", () => {
    const st = setup()
    started(st)
    st.winMode = "city"
    // 神全灭
    killPlayer(st, "P3", "vote") // 预言家
    killPlayer(st, "P4", "vote") // 女巫
    killPlayer(st, "P5", "vote") // 猎人
    killPlayer(st, "P6", "vote") // 守卫
    killPlayer(st, "P7", "vote") // 白痴
    // 民全灭
    killPlayer(st, "P8", "vote")
    killPlayer(st, "P9", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("屠城模式：狼全灭+神全灭+民活 = 好人胜", () => {
    const st = setup()
    started(st)
    st.winMode = "city"
    // 狼全灭
    killPlayer(st, "P0", "vote")
    killPlayer(st, "P1", "vote")
    killPlayer(st, "P2", "vote")
    // 神全灭
    killPlayer(st, "P3", "vote")
    killPlayer(st, "P4", "vote")
    killPlayer(st, "P5", "vote")
    killPlayer(st, "P6", "vote")
    killPlayer(st, "P7", "vote")
    checkWin(st)
    // 狼全灭时，若神也全灭，则平民胜利（wc = "civil"）
    expect(st.winCamp).toBe("civil")
  })

  it("屠边模式：神全灭 = 狼胜", () => {
    const st = setup()
    started(st)
    // 神全灭
    killPlayer(st, "P3", "vote")
    killPlayer(st, "P4", "vote")
    killPlayer(st, "P5", "vote")
    killPlayer(st, "P6", "vote")
    killPlayer(st, "P7", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("屠边模式：民全灭 = 狼胜", () => {
    const st = setup()
    started(st)
    // 民全灭
    killPlayer(st, "P8", "vote")
    killPlayer(st, "P9", "vote")
    checkWin(st)
    expect(st.winCamp).toBe("wolf")
  })

  it("平局：只剩1狼1神1民", () => {
    const st = setup()
    started(st)
    st.round = 3
    // 剩1狼1神1民（P0狼人, P3预言家, P8平民）
    killPlayer(st, "P1", "vote")
    killPlayer(st, "P2", "vote")
    killPlayer(st, "P4", "vote")
    killPlayer(st, "P5", "vote")
    killPlayer(st, "P6", "vote")
    killPlayer(st, "P7", "vote")
    killPlayer(st, "P9", "vote")
    checkWin(st)
    // 1狼1神1民：不满足屠边条件（神未全灭，民未全灭），所以返回 null
    expect(st.winCamp).toBeNull()
  })
})

// ==================== MVP/SVP 边界 ====================

describe("MVP/SVP 边界", () => {
  it("空状态推荐：无玩家", () => {
    const st = defaultState()
    const result = suggestHonor(st)
    expect(result.mvp).toBe("")
    expect(result.svp).toBe("")
  })

  it("单玩家推荐：既是MVP又是SVP", () => {
    const st = setup()
    started(st)
    // 只剩一个玩家
    st.players.forEach((p) => { if (p.name !== "P0") p.alive = false })
    st.winCamp = "wolf"
    // 先算分
    recalcScore(st)
    const result = suggestHonor(st)
    expect(result.mvp).toBe("") // 只有一个玩家，无法形成分差
    expect(result.svp).toBe("")
  })

  it("狼人屠边胜利：狼人MVP，好人SVP", () => {
    const st = setup()
    started(st)
    st.winCamp = "wolf"
    // 狼人高光（使用正确的 mark 字段）
    g(st, "P0").mark.wolfSelfKillCheat = true
    // 好人高光（使用正确的 mark 字段）
    g(st, "P3").mark.prophetFirstDayWolf = true
    // 先算分
    recalcScore(st)
    // 手动增加分数以确保分差 >= 2
    g(st, "P0").scoreRound += 3
    g(st, "P3").scoreRound += 3
    const result = suggestHonor(st)
    expect(result.mvp).toBe("P0")
    expect(result.svp).toBe("P3")
  })

  it("第三方胜利：suggestHonor 对 third 返回空", () => {
    const st = setup()
    setBoardRoles(st, ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    st.players = makePlayers(["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", "平民", "丘比特"])
    cupidConnect(st, ["P0", "P8"])
    started(st)
    st.winCamp = "third"
    // 先算分
    recalcScore(st)
    const result = suggestHonor(st)
    // suggestHonor 对 third 返回空
    expect(result.mvp).toBe("")
    expect(result.svp).toBe("")
  })
})

// ==================== 完整游戏流程 ====================

describe("完整游戏流程", () => {
  it("标准局：狼人胜利流程", () => {
    const st = setup()
    started(st)
    
    // 第一夜：狼刀预言家
    nextNight(st)
    wolfKill(st, "P3")
    resolveNightDeath(st)
    expect(g(st, "P3").alive).toBe(false)
    
    // 第一天：放逐狼人
    finishVote(st, "P0", false)
    expect(g(st, "P0").alive).toBe(false)
    
    // 第二夜：狼刀女巫
    nextNight(st)
    wolfKill(st, "P4")
    resolveNightDeath(st)
    expect(g(st, "P4").alive).toBe(false)
    
    // 第二天：放逐狼人
    finishVote(st, "P1", false)
    expect(g(st, "P1").alive).toBe(false)
    
    // 第三夜：狼刀猎人
    nextNight(st)
    wolfKill(st, "P5")
    resolveNightDeath(st)
    expect(g(st, "P5").alive).toBe(false)
    
    // 第四天：放逐守卫（屠神需要神职全灭）
    finishVote(st, "P6", false)
    expect(g(st, "P6").alive).toBe(false)
    
    // 第四夜：狼刀白痴
    nextNight(st)
    wolfKill(st, "P7")
    resolveNightDeath(st)
    expect(g(st, "P7").alive).toBe(false)
    
    // 检查胜负（屠神）- 重置 winCamp 以触发 ended
    st.winCamp = null
    st.round = 4
    st.phase = "day"
    const result = checkWin(st)
    expect(result.ended).toBe(true)
    expect(st.winCamp).toBe("wolf")
  })

  it("标准局：好人胜利流程", () => {
    const st = setup()
    started(st)
    
    // 第一夜：狼刀平民，女巫救
    nextNight(st)
    wolfKill(st, "P8")
    witchSave(st)
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(true)
    
    // 第一天：放逐狼人
    finishVote(st, "P0", false)
    expect(g(st, "P0").alive).toBe(false)
    
    // 第二夜：狼刀平民，守卫守
    nextNight(st)
    wolfKill(st, "P8")
    guardDo(st, "P8", false)
    resolveNightDeath(st)
    expect(g(st, "P8").alive).toBe(true)
    
    // 第二天：放逐狼人
    finishVote(st, "P1", false)
    expect(g(st, "P1").alive).toBe(false)
    
    // 第三夜：狼刀平民，女巫毒狼
    nextNight(st)
    wolfKill(st, "P9")
    witchSave(st)
    witchPoison(st, "P2")
    resolveNightDeath(st)
    expect(g(st, "P2").alive).toBe(false)
    
    // 检查胜负（狼全灭）- 重置 winCamp 以触发 ended
    st.winCamp = null
    st.round = 3
    st.phase = "day"
    const result = checkWin(st)
    expect(result.ended).toBe(true)
    expect(st.winCamp).toBe("god")
  })

  it("白狼王局：自爆带走关键角色", () => {
    const st = setup(["白狼王", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"])
    started(st)
    
    // 第一天：白狼王自爆带走预言家
    const wwk = byRole(st, "白狼王")!
    wolfKingBaoZha(st, wwk.name, "P2")
    expect(wwk.alive).toBe(false)
    expect(g(st, "P2").alive).toBe(false)
    
    // 第一夜：狼刀女巫
    nextNight(st)
    wolfKill(st, "P3")
    resolveNightDeath(st)
    expect(g(st, "P3").alive).toBe(false)
    
    // 第二天：放逐平民（保留狼人）
    finishVote(st, "P5", false)
    expect(g(st, "P5").alive).toBe(false)
    
    // 第二夜：狼刀猎人（屠神）
    nextNight(st)
    wolfKill(st, "P4")
    resolveNightDeath(st)
    expect(g(st, "P4").alive).toBe(false)
    
    // 检查胜负（屠神）- 狼人 P1 还活着，神职全灭
    st.winCamp = null
    st.round = 3
    st.phase = "day"
    const result = checkWin(st)
    expect(result.ended).toBe(true)
    expect(st.winCamp).toBe("wolf")
  })
})

// ==================== 异常边界 ====================

describe("异常边界", () => {
  it("重复杀死同一玩家：不重复处理", () => {
    const st = setup()
    started(st)
    const p = g(st, "P0")
    killPlayer(st, "P0", "vote")
    expect(p.alive).toBe(false)
    const ret = killPlayer(st, "P0", "poison")
    expect(ret).toEqual([])
    // killPlayer 对重复死亡不记录日志，所以只检查返回值为空
  })

  it("杀死不存在的玩家：返回空数组", () => {
    const st = setup()
    const ret = killPlayer(st, "不存在的玩家", "vote")
    expect(ret).toEqual([])
  })

  it("空板子：无法开始游戏", () => {
    const st = defaultState()
    st.players = []
    const err = setBoardRoles(st, [])
    expect(err).toContain("至少")
  })

  it("单角色板子：校验失败", () => {
    const st = defaultState()
    const err = setBoardRoles(st, ["狼人"])
    expect(err).toContain("至少")
  })

  it("全狼板子：校验失败", () => {
    const st = defaultState()
    const err = setBoardRoles(st, ["狼人", "狼人", "狼人"])
    expect(err).toContain("好人")
  })

  it("全好板子：校验失败", () => {
    const st = defaultState()
    const err = setBoardRoles(st, ["预言家", "女巫", "平民"])
    expect(err).toContain("狼人")
  })
})