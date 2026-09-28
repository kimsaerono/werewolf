import { describe, it, expect, mock } from "bun:test"

mock.module("./../../src/assets/roles/index.ts", () => ({
  roleAvatar: () => "",
  randomDefaultAvatar: () => "",
}))

const { defaultState, newPlayer, renumberPlayers } = await import("./logic")
const { clearForcedWinCache, analyzeCertainty, __packKeyForTest } = await import("./forced-win")
const { checkWin } = await import("./win-checker")

/**
 * 构造一个已开始的对局：roles 按顺序分配，alive=false 的玩家出局。
 * phase 决定「下一个待执行的动作」：night = 守卫/狼人/女巫未表态；day = 投票未发生。
 * 求解结果对两者敏感（白天局先投票再入夜），所以每个用例都要明确自己处于哪个阶段。
 */
function build(
  roles: string[],
  alive: boolean[] = [],
  mode: "edge" | "city" = "edge",
  phase: "night" | "day" = "night",
) {
  clearForcedWinCache()
  const s = defaultState()
  s.board = "9"
  s.winMode = mode
  s.phase = phase
  s.round = 1
  roles.forEach((r, i) => {
    const p = newPlayer(`P${i + 1}`)
    p.role = r
    p.alive = alive[i] !== false
    s.players.push(p)
  })
  renumberPlayers(s)
  return s
}

/**
 * 三档结论。旧用例问的是「哪一方必胜」，那对应 winner（A、B 档都算）；
 * 判「不算必胜」的用例对应 winner === null（均势档）。
 * A 档（真必然、对手无路可走）由下面「三档口径」单独覆盖。
 */
function certainty(s: ReturnType<typeof build>) {
  return analyzeCertainty(s as any)
}

describe("必然结束求解器 · 2狼1猎人1民", () => {
  it("屠边：下一刀屠民，本夜即结束", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
    expect(r.minNights).toBe(1)
  })

  it("屠城：夜刀平民 → 白天放逐猎人（枪响）→ 1 夜结束", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"], [], "city")
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
    // 计入「狼人票数不足时白天放逐好人」后，最优路线是夜刀平民、放逐猎人
    expect(r.minNights).toBe(1)
  })

  it("屠城 2狼1猎人0民：旧启发式会漏报，求解器能识别", () => {
    const s = build(["狼人", "狼人", "猎人"], [], "city")
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
  })
})

describe("必然结束求解器 · 猎人枪不是无敌", () => {
  it("1狼1猎人2民 屠边：猎人枪 + 白天放逐可翻盘，狼人翻不了", () => {
    // 旧求解器只找狼人必胜，这种「好人必胜」的局面会漏报。对称模型必须识别出来。
    const r = certainty(build(["狼人", "猎人", "平民", "平民"]))
    expect(r.winner).toBe("good")
    expect(r.minNights).toBe(1) // 夜刀猎人 → 白天放逐唯一狼
  })

  it("1狼1猎人1民 屠城：枪响后狼人反而输", () => {
    expect(certainty(build(["狼人", "猎人", "平民"], [], "city")).winner).toBe("good") // 夜晚局面
  })
})

describe("必然结束求解器 · 女巫/守卫按最优选择建模", () => {
  it("2狼 + 女巫双药 + 1民 屠城：夜刀女巫 → 白天放逐平民，1 夜结束", () => {
    const s = build(["狼人", "狼人", "女巫", "平民"], [], "city")
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
    expect(r.minNights).toBe(1)
  })

  it("1狼 + 女巫双药 + 2民 屠城：白天直接放逐唯一狼", () => {
    // 好人 3 票对 1 票，入夜后白天直接放逐唯一狼，狼人双药也救不了
    const r = certainty(build(["狼人", "女巫", "平民", "平民"], [], "city"))
    expect(r.winner).toBe("good")
    expect(r.minNights).toBe(1)
  })

  it("2狼 + 守卫 + 1民 屠边：守卫先行动只能猜刀口，必胜", () => {
    const s = build(["狼人", "狼人", "守卫", "平民"])
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
    expect(r.detail).toContain("守卫")
  })

  it("2狼 + 守卫 + 1预言家 + 1民 屠边：守卫守不住，仍是必胜", () => {
    const s = build(["狼人", "狼人", "守卫", "预言家", "平民"])
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
  })

  it("守卫不能连续两晚守同一人，同类多人时按换人守处理", () => {
    // 2狼 + 2神(守卫/预言家) + 1民：守卫上晚守过预言家
    const s = build(["狼人", "狼人", "守卫", "预言家", "平民"])
    s.guardLastTarget = "P4"
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
  })
})

describe("必然结束求解器 · 终局直判", () => {
  it("狼人全灭 → 好人必胜", () => {
    const s = build(["狼人", "猎人", "平民", "平民"], [false, true, true, true])
    const r = certainty(s)
    expect(r.winner).toBe("good")
    expect(r.minNights).toBe(0)
  })

  it("好人全灭 → 狼人必胜", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"], [true, true, false, false])
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
  })

  it("未开始的对局不报必胜", () => {
    const s = defaultState()
    expect(certainty(s).winner).toBeNull()
  })
})

describe("checkWin 与求解器口径一致", () => {
  it("2狼1猎人1民屠边：checkWin 此刻不判胜（等狼人动手）", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    const r = checkWin(s)
    expect(r.ended).toBe(false)
    expect(s.winCamp).toBeNull()
  })

  it("2狼1猎人1民屠边：民全灭后 checkWin 判狼人胜", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    s.players[3].alive = false
    const r = checkWin(s)
    expect(r.ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("翻牌白痴沿用原口径（既不算神也不算民），屠城仍判狼人胜", () => {
    // 与改造前行为保持一致：翻牌白痴不进入任何桶，屠城只看「神与民」是否全灭
    const s = build(["狼人", "白痴", "平民"], [true, true, false], "city")
    s.players[1].mark.idiotFlipped = true
    const r = checkWin(s)
    expect(r.ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("未翻牌白痴仍算神职：屠边要等他出局", () => {
    const s = build(["狼人", "白痴", "平民"], [true, true, true], "edge")
    let r = checkWin(s)
    expect(r.ended).toBe(false)
    s.players[2].alive = false // 平民出局 → 屠民，狼人直接胜
    r = checkWin(s)
    expect(r.ended).toBe(true)
    expect(s.winCamp).toBe("wolf")
  })

  it("本局已结算后 checkWin 不再改写 winCamp（提前结束不会被 refresh 冲掉）", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    s.winCamp = "wolf"
    s.finished = true
    const r = checkWin(s)
    expect(r.ended).toBe(false)
    expect(s.winCamp).toBe("wolf")
  })
})

describe("必然结束求解器 · 前置条件", () => {
  it("角色未分配完毕：不检测", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    s.players[2].role = ""
    expect(certainty(s).winner).toBeNull()
  })

  it("仍是准备阶段（phase=idle 且 round=0）：不检测", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    s.phase = "idle"
    s.round = 0
    expect(certainty(s).winner).toBeNull()
  })

  it("对局已开始且角色分完：正常检测", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"])
    expect(certainty(s).winner).toBe("wolf")
  })
})

describe("必然结束求解器 · 放逐逻辑按真实规则建模", () => {
  it("放逐猎人必须算他的枪：漏算会误报", () => {
    // 1狼 + 1猎人 + 1民 屠城：好人放逐猎人 → 猎人开枪打狼 → 好人胜
    expect(certainty(build(["狼人", "猎人", "平民"], [], "city")).winner).toBe("good")
  })

  it("狼人是唯一狼时放逐他即当场好人胜：狼枪来不及（不得误报）", () => {
    // 白天 3 票对 1 票，放逐狼王当场结束 —— 这正是「不得误报成狼人必胜」的用例
    const r = certainty(build(["狼王", "猎人", "平民", "平民"], [], "edge", "day"))
    expect(r.winner).toBe("good")
    expect(r.minNights).toBe(0)
  })

  it("狼王被放逐后的枪要算进去", () => {
    // 2狼(狼王+普通) + 1猎人 + 1民 屠边：票数持平 → 狼人放逐猎人 → 枪带走狼王 → 屠神狼胜
    const r = certainty(build(["狼王", "狼人", "猎人", "平民"], [], "edge", "day"))
    expect(r.winner).toBe("wolf")
  })

  it("白狼王自爆带走一人也是狼人的白天手段", () => {
    // 2狼(白狼王+普通) + 2民 屠边：白狼王自爆带走平民 → 1狼1民 → 夜刀即屠民
    const r = certainty(build(["白狼王", "狼人", "平民", "平民"], [], "edge"))
    expect(r.winner).toBe("wolf")
  })

  it("好人票数占优时可放逐狼人：不能被算成狼人必胜", () => {
    expect(certainty(build(["狼人", "预言家", "平民", "平民"], [], "edge", "day")).winner).toBe("good")
  })
})

describe("必然结束求解器 · 阶段感知（先投票 vs 先入夜）", () => {
  it("白天局面：好人票数占优，现在就能放逐狼人 → 不算必胜", () => {
    // 同一局面放在夜晚，入夜后狼人刀死预言家即屠神；放在白天，先投票就能放逐狼人
    const day = build(["狼人", "预言家", "平民", "平民"], [], "edge", "day")
    expect(certainty(day).winner).toBe("good") // 白天先投票：好人放逐唯一狼
    const night = build(["狼人", "预言家", "平民", "平民"], [], "edge", "night")
    expect(certainty(night).winner).toBe("wolf") // 先入夜：狼人刀死预言家即屠神
  })

  it("白天局面：平票由法官裁决，狼人最慢也要 1 夜", () => {
    // 放逐平民确实 0 夜结束，但那不是狼人能决定的：法官若放逐猎人或狼人，就要再入夜。
    // 求解器对法官取 AND（全部裁决都要对目标方有利），所以最慢路径是 1 夜。
    const s = build(["狼人", "狼人", "猎人", "平民"], [], "edge", "day")
    const r = certainty(s)
    expect(r.winner).toBe("wolf")
    expect(r.minNights).toBe(1)
  })

  it("夜晚局面：要等入夜，minNights ≥ 1", () => {
    const s = build(["狼人", "狼人", "猎人", "平民"], [], "edge", "night")
    expect(certainty(s).minNights).toBeGreaterThanOrEqual(1)
  })
})

describe("必然结束求解器 · 三档口径", () => {
  it("B 档：好人必胜但狼人仍有翻盘路径 —— 1狼1预1猎2民 屠边", () => {
    const r = certainty(build(["狼人", "预言家", "猎人", "平民", "平民"]))
    expect(r.tier).toBe("oneSided")
    expect(r.winner).toBe("good")
    expect(r.underdog).toBe("wolf")
  })

  it("B 档：狼人必胜但好人仍有翻盘路径 —— 2狼2民1预1猎 屠边", () => {
    const r = certainty(build(["狼人", "狼人", "平民", "平民", "预言家", "猎人"]))
    expect(r.tier).toBe("oneSided")
    expect(r.winner).toBe("wolf")
    expect(r.underdog).toBe("good")
  })

  it("A 档：屠城 1狼3神，狼人无论刀谁都救不回来", () => {
    // 狼人夜刀 1 神 → 好人仍有 2 票对 1 狼，白天放逐唯一狼即结束；
    // 屠城要神与民同时全灭，而此处 0 民，狼人永远凑不出「屠民」，也没有翻盘路径。
    const r = certainty(build(["狼人", "守卫", "猎人", "预言家"], [], "city"))
    expect(r.tier).toBe("forced")
    expect(r.winner).toBe("good")
    expect(r.underdog).toBeNull()
    expect(r.minNights).toBe(1)
  })

  it("A 档：同一局面放白天就是 0 夜", () => {
    const r = certainty(build(["狼人", "守卫", "猎人", "预言家"], [], "city", "day"))
    expect(r.tier).toBe("forced")
    expect(r.winner).toBe("good")
    expect(r.minNights).toBe(0)
  })

  it("A 档细节写明已无翻盘路径，B 档细节写明对手仍需犯错", () => {
    const a = certainty(build(["狼人", "守卫", "猎人", "预言家"], [], "city"))
    expect(a.detail).toContain("已无翻盘路径")
    const b = certainty(build(["狼人", "预言家", "猎人", "平民", "平民"]))
    expect(b.detail).toContain("仍有一条翻盘路径")
  })

  it("屠边 1狼1预2民 白天：放逐预言家就是屠神，所以只到 B 档", () => {
    // 好人 3 票对 1 票能立刻放逐狼人，但只要放逐了预言家就是屠神、狼人当场胜；
    // 弱势方有路径就不能报 100%。
    // 注意：屠边下「神全灭」本身就是终局，所以不能用 0 神的盘当例子。
    const r = certainty(build(["狼人", "预言家", "平民", "平民"], [], "edge", "day"))
    expect(r.tier).toBe("oneSided")
    expect(r.winner).toBe("good")
    expect(r.underdog).toBe("wolf")
    expect(r.minNights).toBe(0)
  })
})

describe("记忆化键编码", () => {
  const base = {
    w: 1,
    g: 2,
    c: 1,
    flipped: 0,
    witch: null as null | { antidote: boolean; poison: boolean; selfSave: boolean },
    guard: null as null | { last: null },
    hunter: false,
    knight: false,
    hasWk: false,
    hasWwk: false,
  }

  it("各字段单独变化时键必须不同（位段排错会静默撞键）", () => {
    const variants: Array<[string, ReturnType<typeof __packKeyForTest>]> = [
      ["基准", __packKeyForTest(base, 4, true)],
      ["狼人 +1", __packKeyForTest({ ...base, w: 2 }, 4, true)],
      ["神 +1", __packKeyForTest({ ...base, g: 3 }, 4, true)],
      ["民 +1", __packKeyForTest({ ...base, c: 2 }, 4, true)],
      ["翻牌白痴 +1", __packKeyForTest({ ...base, flipped: 1 }, 4, true)],
      ["翻牌白痴 +2", __packKeyForTest({ ...base, flipped: 2 }, 4, true)],
      ["女巫存活", __packKeyForTest({ ...base, witch: { antidote: false, poison: false, selfSave: false } }, 4, true)],
      ["女巫有解药", __packKeyForTest({ ...base, witch: { antidote: true, poison: false, selfSave: false } }, 4, true)],
      ["女巫有毒", __packKeyForTest({ ...base, witch: { antidote: false, poison: true, selfSave: false } }, 4, true)],
      ["女巫可自救", __packKeyForTest({ ...base, witch: { antidote: false, poison: false, selfSave: true } }, 4, true)],
      ["守卫存活", __packKeyForTest({ ...base, guard: { last: null } }, 4, true)],
      ["猎人存活", __packKeyForTest({ ...base, hunter: true }, 4, true)],
      ["骑士存活", __packKeyForTest({ ...base, knight: true }, 4, true)],
      ["狼王存活", __packKeyForTest({ ...base, hasWk: true }, 4, true)],
      ["白狼王存活", __packKeyForTest({ ...base, hasWwk: true }, 4, true)],
      ["阶段转白天", __packKeyForTest(base, 4, false)],
      ["剩余夜数 -1", __packKeyForTest(base, 3, true)],
    ]
    for (const [i, [nameI, ki]] of variants.entries()) {
      for (const [j, [nameJ, kj]] of variants.entries()) {
        if (i >= j) continue
        if (ki === kj) throw new Error(`记忆化键撞键：${nameI} 与 ${nameJ} 算出同一个键 ${ki}`)
      }
    }
  })

  it("2 个翻牌白痴与「1 个翻牌白痴 + 女巫存活」不撞键", () => {
    // 这两个局面在旧的位段布局里会算出同一个键（flipped<<12 压到了女巫的位段上），
    // 求解器会拿一个局面的结论当另一个局面用 —— 表现是「凭空多出必胜/均势」。
    const twoIdiots = __packKeyForTest({ ...base, flipped: 2, witch: null }, 4, true)
    const oneIdiotPlusWitch = __packKeyForTest(
      { ...base, flipped: 0, witch: { antidote: false, poison: false, selfSave: false } },
      4,
      true,
    )
    if (twoIdiots === oneIdiotPlusWitch) throw new Error("记忆化键撞键：2 个翻牌白痴 与 1 个翻牌白痴+女巫存活 同键")
  })
})
