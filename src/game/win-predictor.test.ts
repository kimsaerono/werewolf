import { describe, it, expect, mock } from "bun:test"

mock.module("./../../src/assets/roles/index.ts", () => ({
  roleAvatar: () => "",
  randomDefaultAvatar: () => "",
}))

const { defaultState, newPlayer, renumberPlayers } = await import("./logic")
const { predictWinRate } = await import("./win-predictor")

describe("win-predictor baseline", () => {
  it("fresh 9-player standard board opens 50/50", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    const r = predictWinRate(s)
    expect(r.rates.wolf).toBe(50)
    expect(r.rates.good).toBe(50)
    expect(r.hasThird).toBe(false)
    console.log("fresh 9p → wolf:", r.rates.wolf, "good:", r.rates.good)
  })

  it("one wolf dead → wolf rate drops", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    s.players.find(p => p.role === "狼人")!.alive = false
    const r = predictWinRate(s)
    expect(r.rates.wolf).toBeLessThan(30)
    console.log("1 wolf dead → wolf:", r.rates.wolf, "good:", r.rates.good)
  })

  it("no third party shown for plain board", () => {
    const s = defaultState()
    s.board = "9"
    const names = ["A","B","C","D","E","F","G","H","I"]
    const roles = ["狼人","狼人","狼人","预言家","女巫","猎人","平民","平民","平民"]
    for (let i = 0; i < 9; i++) {
      const p = newPlayer(names[i])
      p.role = roles[i]
      s.players.push(p)
    }
    renumberPlayers(s)
    expect(predictWinRate(s).hasThird).toBe(false)
  })
})

const { noteUnderdog, finishGameAuto, buildAutoRecord, defaultState: freshState } = await import("./logic")
const { clearForcedWinCache } = await import("./forced-win")

/** 构造一个指定角色配置的局面 */
function tierState(roles: string[], phase: "night" | "day" = "night", winMode: "edge" | "city" = "edge") {
  clearForcedWinCache()
  const s = defaultState()
  s.board = "9"
  s.winMode = winMode
  s.phase = phase
  s.round = 1
  roles.forEach((role, i) => {
    const p = newPlayer(`P${i + 1}`)
    p.role = role
    p.alive = true
    s.players.push(p)
  })
  renumberPlayers(s)
  return s
}

/** 胜率是否还是启发式的平滑区间（3~97），也就是没被档位极值覆盖 */
function isHeuristicRate(r: ReturnType<typeof predictWinRate>): boolean {
  return r.rates.wolf >= 3 && r.rates.wolf <= 97 && r.rates.good >= 3 && r.rates.good <= 97
}

const hasTierTag = (r: ReturnType<typeof predictWinRate>) => r.factors.some((f) => f.startsWith("\u2696\ufe0f"))

describe("三档确定度 → 胜率显示", () => {
  it("A 档：弱势方 1%，且给出提前结束入口", () => {
    // 屠城 + 夜晚：两个预言家已验人、守卫守得住，单狼已无获胜路径
    const r = predictWinRate(tierState(["狼人", "预言家", "预言家", "猎人", "守卫", "骑士"], "night", "city"))
    expect(r.certainty.tier).toBe("forced")
    expect(r.certainty.winner).toBe("good")
    expect(r.certainty.underdog).toBeNull()
    expect(r.rates.good).toBe(99)
    expect(r.rates.wolf).toBe(1)
    expect(r.forcedWin?.detected).toBe(true)
  })

  it("B 档同向：胜率用启发式平滑值，不被钉成 99/1", () => {
    // 求解器说好人占优，启发式也说好人占优 → 数字平滑 + 保留 ⚖️ 提示
    const r = predictWinRate(tierState(["狼人", "预言家", "猎人", "平民", "平民"]))
    expect(r.certainty.tier).toBe("oneSided")
    expect(r.certainty.winner).toBe("good")
    expect(r.certainty.underdog).toBe("wolf")
    expect(isHeuristicRate(r)).toBe(true)
    expect(r.rates.good).toBeGreaterThan(r.rates.wolf)
    // B 档只是「占优」，拿它一键结束会把弱势方的翻盘路掐死
    expect(r.forcedWin).toBeNull()
    expect(hasTierTag(r)).toBe(true)
  })

  it("B 档反向：求解器与启发式方向相反时不出 ⚖️ 提示，避免自相矛盾", () => {
    // 1狼2民1预1猎：求解器按行动权判狼人占优，但启发式按牌面判好人占优(68%)
    const r = predictWinRate(tierState(["狼人", "狼人", "平民", "平民", "预言家", "猎人"]))
    expect(r.certainty.tier).toBe("oneSided")
    expect(r.certainty.winner).toBe("wolf")
    expect(r.certainty.underdog).toBe("good")
    expect(isHeuristicRate(r)).toBe(true)
    // 数字说好人更高，就不能同时说「狼人占优」
    expect(r.rates.good).toBeGreaterThan(r.rates.wolf)
    expect(hasTierTag(r)).toBe(false)
  })

it("3狼+1民+1预 现在是 A 档（minNights=1 → 1%），不再是 B 档", () => {
    // 3狼+1民+1预：好人票数 2 < 狼人 3，白天放逐不出狼人。
    // 去掉 reach 里的狼人空刀/自爆后，好人无任何翻盘路径 → A 档。
    const r = predictWinRate(tierState(["狼人", "狼人", "狼人", "预言家", "平民"]))
    expect(r.certainty.tier).toBe("forced")
    expect(r.certainty.winner).toBe("wolf")
    expect(r.certainty.underdog).toBeNull()
    expect(r.certainty.minNights).toBe(1)
    expect(r.rates.wolf).toBe(99)
    expect(r.rates.good).toBe(1)
    expect(r.forcedWin).not.toBeNull()
    expect(r.forcedWin?.detected).toBe(true)
  })

  it("C 档：均势，winner/underdog 都为 null", () => {
    // 屠城 + 夜晚：两守卫能互守，单狼刀不到关键好人
    const r = predictWinRate(tierState(["狼人", "预言家", "守卫", "守卫"], "night", "city"))
    expect(r.certainty.tier).toBe("even")
    expect(r.certainty.winner).toBeNull()
    expect(r.certainty.underdog).toBeNull()
    expect(isHeuristicRate(r)).toBe(true)
    expect(r.forcedWin).toBeNull()
    expect(hasTierTag(r)).toBe(false)
  })
})

describe("标准 9 人局：不该出现 1%/99% 极值", () => {
  const ROLES = ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"]
  const build = () => tierState(ROLES, "night")

  it("开局就是 50/50", () => {
    const r = predictWinRate(build())
    expect(r.rates.wolf).toBe(50)
    expect(r.rates.good).toBe(50)
  })

  it("开局 → 狼刀 → 女巫阵亡，全程保持启发式平滑值", () => {
    const s = build()
    const seen: Array<[string, number]> = []
    seen.push(["首夜未刀", predictWinRate(s).rates.wolf])
    s.players.find((p) => p.role === "平民")!.alive = false
    clearForcedWinCache()
    seen.push(["狼刀1民后", predictWinRate(s).rates.wolf])
    s.players.find((p) => p.role === "女巫")!.alive = false
    s.round = 2
    clearForcedWinCache()
    seen.push(["女巫阵亡", predictWinRate(s).rates.wolf])
    for (const [tag, wolf] of seen) {
      expect(wolf).toBeGreaterThanOrEqual(3)
      expect(wolf).toBeLessThanOrEqual(97)
      expect(wolf).not.toBe(1)
      expect(wolf).not.toBe(99)
      console.log(`${tag} → 狼人 ${wolf}%`)
    }
  })

  /** 杀掉 count 个指定角色的玩家（逐个匹配，避免 find 永远命中同一人） */
  function kill(s: ReturnType<typeof build>, role: string, count = 1) {
    let left = count
    for (const p of s.players) {
      if (p.role !== role || !p.alive) continue
      p.alive = false
      if (--left === 0) break
    }
  }

  it("前期到中期不误触发 A 档（提前结束按钮不会乱弹）", () => {
    const mid: Array<[string, (s: ReturnType<typeof build>) => void]> = [
      ["开局", () => {}],
      ["狼刀1民", (s) => kill(s, "平民")],
      ["狼刀2民", (s) => kill(s, "平民", 2)],
      ["女巫阵亡", (s) => kill(s, "女巫")],
      // "女巫+猎人阵亡" 在屠边 9 人局里已是狼人必胜（独立 oracle 交叉验证），不再列入反例
    ]
    for (const [tag, apply] of mid) {
      const s = build()
      apply(s)
      clearForcedWinCache()
      const r = predictWinRate(s)
      expect([tag, r.certainty.tier]).not.toEqual([tag, "forced"])
      expect(isHeuristicRate(r)).toBe(true)
    }
  })

  it("真正的死局才出现 1/99 极值：神职全死、狼3好3", () => {
    // 3狼 vs 3民、已无任何神职：屠边模式下 god=0 已满足“屠边”胜利条件，
    // 当前即终局（minNights=0），弱势方 0% 是正确的
    const s = build()
    kill(s, "女巫")
    kill(s, "猎人")
    kill(s, "预言家")
    s.round = 4
    clearForcedWinCache()
    const r = predictWinRate(s)
    expect(s.players.filter((p) => p.alive).length).toBe(6)
    expect(r.certainty.tier).toBe("forced")
    expect(r.certainty.winner).toBe("wolf")
    expect(r.rates.wolf).toBe(100)
    expect(r.rates.good).toBe(0)
    expect(r.forcedWin?.detected).toBe(true)
  })
})

describe("狼美人启发式建模", () => {
  const build = () => {
    const s = defaultState()
    s.board = "9"
    const roles = ["狼人", "狼人", "狼美人", "预言家", "女巫", "猎人", "平民", "平民", "平民"]
    s.boardRoles = roles
    roles.forEach((role, i) => {
      const p = newPlayer(`P${i + 1}`)
      p.role = role
      s.players.push(p)
    })
    renumberPlayers(s)
    return s
  }

  it("魅惑好人后狼人胜率不降并给出因子", () => {
    const s = build()
    clearForcedWinCache()
    const r1 = predictWinRate(s)
    s.charmedName = s.players.find((p) => p.role === "平民")!.name
    clearForcedWinCache()
    const r2 = predictWinRate(s)
    expect(r2.rates.wolf).toBeGreaterThanOrEqual(r1.rates.wolf)
    expect(r2.factors.some((f) => f.includes("已魅惑好人"))).toBe(true)
  })

  it("狼美人出局后给出因子", () => {
    const s = build()
    s.players.find((p) => p.role === "狼美人")!.alive = false
    clearForcedWinCache()
    const r = predictWinRate(s)
    expect(r.factors.some((f) => f.includes("狼美人已出局"))).toBe(true)
  })
})

describe("绝地翻盘：只有被持续压制过的阵营才算翻盘", () => {
  const ROLES = ["狼人", "预言家", "猎人", "平民", "平民"]

  it("单次观察到的劣势不算压制（多半只是轮到谁动手）", () => {
    const s = tierState(ROLES)
    expect(noteUnderdog(s, "wolf")).toBe(false)
    expect(s.underdogs).toEqual([])
    finishGameAuto(s, { camp: "wolf", reason: "测试" })
    expect(s.comeback).toBe(false)
  })

  it("连续两次劣势后该阵营获胜 → 标记绝地翻盘并写进复盘", () => {
    const s = tierState(ROLES)
    expect(noteUnderdog(s, "wolf")).toBe(false)
    expect(noteUnderdog(s, "wolf")).toBe(true) // 连续第二次才计入
    expect(s.underdogs).toEqual(["wolf"])
    finishGameAuto(s, { camp: "wolf", reason: "测试" })
    expect(s.comeback).toBe(true)
    expect(buildAutoRecord(s)).toContain("绝地翻盘")
  })

  it("优势方获胜 → 不标记，复盘里也不出现", () => {
    const s = tierState(ROLES)
    noteUnderdog(s, "wolf")
    noteUnderdog(s, "wolf")
    finishGameAuto(s, { camp: "god", reason: "测试" })
    expect(s.comeback).toBe(false)
    expect(buildAutoRecord(s)).not.toContain("绝地翻盘")
  })

  it("劣势方在优势方之后接力压制 → 两个阵营都记上（不重复计数）", () => {
    const s = tierState(ROLES)
    noteUnderdog(s, "wolf")
    noteUnderdog(s, "wolf")
    noteUnderdog(s, "good")
    noteUnderdog(s, "good")
    expect(s.underdogs).toEqual(["wolf", "good"])
    expect(noteUnderdog(s, "good")).toBe(false)
    expect(s.underdogs).toEqual(["wolf", "good"])
  })

  it("新局清空记录", () => {
    const s = freshState()
    expect(s.underdogs).toEqual([])
    expect(s.comeback).toBe(false)
    expect(s.underdogStreak).toBe(0)
    expect(s.underdogCamp).toBeNull()
  })
})

describe("胜率预测 · 黑化野孩子 / 炸弹人第三方", () => {
  function predictState(roles: string[], lovers: string[] = [], transformed: string[] = []) {
    const s = defaultState()
    s.boardRoles = [...roles]
    s.phase = "night"
    s.round = 1
    roles.forEach((role, i) => {
      const p = newPlayer(`P${i}`)
      p.role = role
      s.players.push(p)
    })
    if (transformed.length) {
      for (const name of transformed) {
        const p = s.players.find((x) => x.name === name)
        if (p) p.mark.isTransform = true
      }
    }
    s.lovers = lovers
    renumberPlayers(s)
    return predictWinRate(s)
  }

  it("黑化野孩子不再算平民：只剩 1 个真平民时给出屠民提示", () => {
    const r = predictState(["野孩子", "平民", "狼人", "狼人"], [], ["P0"])
    expect(r.factors).toContain("⚰️ 平民仅剩 1 · 屠民在即")
  })

  it("黑化野孩子不会让「已倒狼数」变负 / 凭空多报已倒", () => {
    const r = predictState(["野孩子", "平民", "狼人", "狼人"], [], ["P0"])
    expect(r.factors.some((f) => f.includes("已倒 -"))).toBe(false)
    expect(r.factors.some((f) => f.includes("已倒 1 狼"))).toBe(false)
  })

  it("WG→WW：黑化后第三方解散，hasThird=false、第三方胜率 0", () => {
    const r = predictState(["野孩子", "狼人", "丘比特", "平民"], ["P0", "P1"], ["P0"])
    expect(r.hasThird).toBe(false)
    expect(r.rates.third).toBe(0)
  })

  it("GG→WG：黑化后第三方成立，hasThird=true、第三方胜率 > 0", () => {
    const r = predictState(["野孩子", "狼人", "丘比特", "平民"], ["P0", "P3"], ["P0"])
    expect(r.hasThird).toBe(true)
    expect(r.rates.third).toBeGreaterThan(0)
    expect(r.factors).toContain("💘 人狼恋·第三方")
  })

  it("炸弹人存活：hasThird=true，并给出独立第三方提示", () => {
    const r = predictState(["炸弹人", "狼人", "平民"])
    expect(r.hasThird).toBe(true)
    expect(r.rates.third).toBeGreaterThan(0)
    expect(r.factors).toContain("💣 炸弹人存活·独立第三方")
    expect(r.factors).not.toContain("💘 人狼恋·第三方")
  })
})

describe("胜率预测 · GG→WG 起始狼数边界", () => {
  it("黑化野孩子归第三方时不应被误算成已倒狼", () => {
    const s = defaultState()
    const roles = ["野孩子", "狼人", "丘比特", "平民"]
    s.boardRoles = [...roles]
    s.phase = "night"
    s.round = 1
    roles.forEach((role, i) => {
      const p = newPlayer(`P${i}`)
      p.role = role
      s.players.push(p)
    })
    s.players[0].mark.isTransform = true // GG→WG：野孩子=狼恋人，P1=狼恋人，均为第三方
    s.lovers = ["P0", "P3"]
    renumberPlayers(s)
    const r = predictWinRate(s)
    expect(r.factors.some((f) => f.includes("已倒"))).toBe(false)
  })
})
