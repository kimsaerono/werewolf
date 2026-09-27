import { describe, it, expect, mock } from "bun:test"

mock.module("./../../src/assets/roles/index.ts", () => ({ roleAvatar: () => "", randomDefaultAvatar: () => "" }))
const L: any = await import("./logic")
const { analyzeCertainty } = await import("./forced-win")

/**
 * 「绝不误报」底线测试。
 *
 * 这里的 oracle 是一份**独立实现**的极小化博弈树搜索，只依据 logic.ts / night-resolver.ts
 * 里的真实规则书写（屠边/屠城判胜、猎人被刀或被放逐都能开枪且归好人决策、
 * 控票方取最优、空刀），刻意不复用 forced-win 的任何代码，避免「自己验自己」。
 *
 * 求解器是对称的（会分别替双方搜必胜策略），oracle 也是对称的，且同为 4 夜窗口，
 * 所以两者应当对「哪一方必胜」完全一致。判据：
 *
 * - 求解器报了必胜方、oracle 给出相反或不确定的结论 → 硬失败（误报，等于给玩家错误结论）。
 * - oracle 说某方必胜、求解器没报 → 允许（漏报，方向上宁可保守）。
 *   oracle 本身是极小化实现，本来就可能看不到更长的胜路。
 */
interface OraclePlayer {
  wolf: boolean
  god: boolean
  witch: boolean
  gun: "none" | "hunter"
}
interface St {
  a: boolean[]
  anti: boolean
  pois: boolean
}

function makeOracle(players: OraclePlayer[], mode: "edge" | "city") {
  const wit = players.findIndex((p) => p.witch)
  const memo = new Map<string, "W" | "G" | "D">()
  const key = (s: St) => s.a.map((x) => (x ? 1 : 0)).join("") + (s.anti ? "A" : "-") + (s.pois ? "P" : "-")

  const live = (s: St) => players.map((p, i) => ({ p, i })).filter(({ i }) => s.a[i])
  const counts = (s: St) => {
    let wolf = 0, god = 0, civ = 0
    for (const { p, i } of live(s)) {
      if (!s.a[i]) continue
      if (p.wolf) wolf++
      else if (p.god) god++
      else civ++
    }
    return { wolf, god, civ }
  }
  const terminal = (s: St): "W" | "G" | null => {
    const c = counts(s)
    if (c.wolf === 0) return "G"
    const won = mode === "edge" ? c.god === 0 || c.civ === 0 : c.god === 0 && c.civ === 0
    return won ? "W" : null
  }
  const killed = (s: St, i: number): St => ({ ...s, a: s.a.map((x, j) => (j === i ? false : x)) })
  /** 猎人出局后开枪：归好人决策，最优就是带走一只狼人 */
  const hunterGun = (s: St, dead: number): St[] => {
    if (dead < 0 || players[dead].gun !== "hunter") return [s]
    for (const { p, i } of live(s)) if (i !== dead && p.wolf && s.a[i]) return [killed(s, i)]
    return [s]
  }
  /** 相对 s 本夜新死的人里，第一个猎人（用于结算枪） */
  const deadHunter = (s: St, b: St) => players.findIndex((p, i) => p.gun === "hunter" && s.a[i] && !b.a[i])

  const uniqStates = (list: St[]): St[] => [...new Map(list.map((b) => [key(b), b])).values()]

  /** 女巫的全部打法：不解毒 / 解药救本夜被刀者（仅首夜可自救）/ 毒药毒狼 */
  const witchBranches = (s: St, after: St, round: number): St[] => {
    const combos: St[] = [after]
    // 注意：wit === 0 是合法下标，不能用 !wit 当「无女巫」的判据，
    // 否则女巫排在首位时会在自己已经出局的情况下仍然用出解药（结果依赖角色排列顺序）。
    const witchAlive = wit >= 0 && s.a[wit] && after.a[wit]
    if (!witchAlive) return combos
    for (let i = 0; i < players.length; i++) {
      if (!s.a[i] || after.a[i]) continue
      if (i === wit && round > 1) continue
      combos.push({ ...after, a: after.a.map((x, j) => (j === i ? true : x)), anti: false })
    }
    if (s.pois && counts(after).wolf > 0) {
      for (const { p, i } of live(after)) {
        if (p.wolf && s.a[i]) combos.push(killed({ ...after, pois: false }, i))
      }
    }
    return combos
  }

  const go = (s: St, night: number, turn: "night" | "day", round: number): "W" | "G" | "D" => {
    const t = terminal(s)
    if (t) return t
    if (night === 0) return "D"
    const k = `${key(s)}|${night}|${turn}|${round}`
    const hit = memo.get(k)
    if (hit) return hit
    let res: "W" | "G" | "D"

    if (turn === "night") {
      // 狼人选择：空刀 或 刀一个好人
      const kills: St[] = []
      for (const { p, i } of live(s)) if (!p.wolf) kills.push(killed(s, i))
      kills.push(s)

      // 女巫的选择是对手决策，必须先按刀口分组再取交集。
      // 之前把女巫分支和刀口一起拍平后取 some(==="W")，等于允许女巫放弃自己的解药、
      // 主动配合狼人屠民 —— 那会把「狼人必胜」误判出来（女巫有解药时狼人其实拿不到必胜）。
      const perKill = kills.map((after) => {
        const withGun = witchBranches(s, after, round).flatMap((b) => hunterGun(b, deadHunter(s, b)))
        const uniq = uniqStates(withGun)
        const ws = uniq.map((b) => go(b, night - 1, "day", round + 1))
        return {
          // 狼人必胜：要「有一刀」且女巫每种打法都利好狼人
          allW: ws.length > 0 && ws.every((x) => x === "W"),
          // 好人必胜：要「每刀都赢」，而女巫属好人方，她的打法取最优（存在一种能赢即可）
          anyG: ws.some((x) => x === "G"),
        }
      })
      res = perKill.some((k) => k.allW) ? "W" : perKill.every((k) => k.anyG) ? "G" : "D"
    } else {
      const raw: St[] = []
      for (const { i } of live(s)) raw.push(killed(s, i))
      const bs = raw.flatMap((b) => hunterGun(b, deadHunter(s, b)))
      const uniq = uniqStates(bs)
      const c = counts(s)
      const good = c.god + c.civ
      if (good > c.wolf) {
        // 好人控票：好人自选（存在一条好人赢即可）
        res = uniq.some((b) => go(b, night, "night", round) === "G")
          ? "G"
          : uniq.every((b) => go(b, night, "night", round) === "W")
            ? "W"
            : "D"
      } else if (good < c.wolf) {
        // 狼人控票：狼人自选（存在一条狼人赢即可）
        res = uniq.some((b) => go(b, night, "night", round) === "W")
          ? "W"
          : uniq.every((b) => go(b, night, "night", round) === "G")
            ? "G"
            : "D"
      } else {
        // 平票由法官指定：法官是第三方，对双方都取 AND —— 全部裁决都要利好目标方才算必胜
        res = uniq.every((b) => go(b, night, "night", round) === "W")
          ? "W"
          : uniq.every((b) => go(b, night, "night", round) === "G")
            ? "G"
            : "D"
      }
    }
    memo.set(k, res)
    return res
  }

  return (): "W" | "G" | "D" => go({ a: players.map(() => true), anti: true, pois: true }, 4, "night", 1)
}

const GOD_ROLES = new Set(["预言家", "猎人", "女巫"])
function toOraclePlayer(role: string): OraclePlayer {
  return { wolf: role === "狼人", god: GOD_ROLES.has(role), witch: role === "女巫", gun: role === "猎人" ? "hunter" : "none" }
}
function buildState(roles: string[], mode: "edge" | "city") {
  const s: any = L.defaultState()
  s.judge = "法官"
  s.winMode = mode
  roles.forEach((r, i) => {
    const p = L.newPlayer("P" + (i + 1))
    p.role = r
    s.players.push(p)
  })
  L.renumberPlayers(s)
  L.manualSaveRoles(s)
  s.phase = "night"
  s.round = 1
  return s
}

const ROLE_POOL = ["狼人", "预言家", "猎人", "女巫", "平民"] as const
function enumerate(n: number): string[][] {
  const out: string[][] = []
  const cur: string[] = []
  const rec = (i: number) => {
    if (i === n) {
      out.push(cur.slice())
      return
    }
    for (const r of ROLE_POOL) {
      cur.push(r)
      rec(i + 1)
      cur.pop()
    }
  }
  rec(0)
  return out
}

interface Case {
  roles: string[]
  mode: "edge" | "city"
  /** 独立 oracle 的结论：W 狼人必胜 / G 好人必胜 / D 谁也必胜不了 */
  truth: "W" | "G" | "D"
  winner: "wolf" | "good" | "third" | "draw" | null
  tier: "forced" | "oneSided" | "even"
  underdog: "wolf" | "good" | null
}
function sweep(size: number, opts: { maxWolves: number; maxCivil: number }): Case[] {
  const out: Case[] = []
  for (const roles of enumerate(size)) {
    const wolves = roles.filter((r) => r === "狼人").length
    if (wolves < 1 || wolves > opts.maxWolves) continue
    if (roles.filter((r) => r === "预言家").length > 1) continue
    if (roles.filter((r) => r === "猎人").length > 1) continue
    if (roles.filter((r) => r === "女巫").length > 1) continue
    if (roles.filter((r) => r === "平民").length > opts.maxCivil) continue
    for (const mode of ["edge", "city"] as const) {
      const truth = makeOracle(roles.map(toOraclePlayer), mode)()
      const r = analyzeCertainty(buildState(roles, mode) as any)
      out.push({ roles, mode, truth, winner: r.winner, tier: r.tier, underdog: r.underdog })
    }
  }
  return out
}

describe("必然结束求解器 · 独立 oracle 交叉验证（底线：绝不误报）", () => {
  /** oracle 用字母表示阵营，求解器用阵营名，比较前先对齐 */
  const TRUTH: Record<"W" | "G" | "D", "wolf" | "good" | null> = { W: "wolf", G: "good", D: null }

  const checkNoFalseWin = (cases: Case[]) => {
    // 求解器报了某方必胜，oracle 必须认同这一方
    const bad = cases.filter((c) => c.winner !== null && c.winner !== TRUTH[c.truth])
    expect(bad.map((c) => `${c.roles.join("/")} ${c.mode} 求解器=${c.winner} oracle=${c.truth}`)).toEqual([])
    // 三档结构自洽：even 无必胜方；forced 有必胜方且无弱势方；oneSided 两者都有且不同
    for (const c of cases) {
      if (c.tier === "even") {
        expect(c.winner).toBeNull()
        expect(c.underdog).toBeNull()
      } else if (c.tier === "forced") {
        expect(c.winner).not.toBeNull()
        expect(c.underdog).toBeNull()
      } else {
        expect(c.winner).not.toBeNull()
        expect(c.underdog).not.toBeNull()
        expect(c.underdog).not.toBe(c.winner)
      }
    }
  }

  it("3~4 人局（狼人/预言家/猎人/女巫/平民）必胜方与 oracle 一致", () => {
    const cases = sweep(4, { maxWolves: 2, maxCivil: 2 })
    expect(cases.length).toBeGreaterThan(200)
    checkNoFalseWin(cases)
  })

  it("5 人局必胜方与 oracle 一致", () => {
    const cases = sweep(5, { maxWolves: 2, maxCivil: 2 })
    expect(cases.length).toBeGreaterThan(100)
    checkNoFalseWin(cases)
  })

  // REACH_BUDGET 已提高到 300_000（为消除冷/热缓存的档位抖动），
  // 6 人全量 sweep 约 7s，超出 bun:test 默认 5s；这是测试框架上限，不是产品回归。
  it("6 人局必胜方与 oracle 一致", () => {
    const cases = sweep(6, { maxWolves: 2, maxCivil: 2 })
    expect(cases.length).toBeGreaterThan(200)
    checkNoFalseWin(cases)
  }, 60_000)

  it("2狼2民1预1猎人：屠边狼人必胜、屠城不报", () => {
    const roles = ["狼人", "狼人", "预言家", "猎人", "平民", "平民"]
    const oracle = makeOracle(roles.map(toOraclePlayer), "edge")
    expect(oracle()).toBe("W")
    expect(makeOracle(roles.map(toOraclePlayer), "city")()).toBe("G")
    const edge = analyzeCertainty(buildState(roles, "edge") as any)
    expect(edge.winner).toBe("wolf")
    expect(edge.underdog).toBe("good")
    // 屠城：独立 oracle 判好人必胜，求解器也要认同这一方
    // （A / B 档的分界取决于「弱势方是否还有可达胜路」，oracle 没有这一层，不在这里断言）
    const city = analyzeCertainty(buildState(roles, "city") as any)
    expect(city.winner).toBe("good")
    expect(city.underdog).toBe("wolf")
  })
})

