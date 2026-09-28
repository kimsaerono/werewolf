import type { GameState } from "./logic"
import { isWolfRole } from "./logic"
import { aliveCampCounts, getChainType, goodWinNow, isGameStarted, isThirdMember, wolfWinNow } from "./win-checker"
import type { CampCounts } from "./win-checker"
import { getRoleInstance } from "./roles/builtin"

export type { CampCounts }

export type WinMode = "edge" | "city"

/** 求解目标阵营 */
type Camp = "wolf" | "good"

/** 终局可能的胜方（含第三方与平局） */
export type WinCamp = "wolf" | "good" | "third" | "draw"

/** 决策点控制方：judge = 无人可控（平票时由法官指定出局者） */
type Controller = Camp | "judge"

export interface ForcedWin {
  detected: true
  winner: WinCamp
  reason: string
  detail: string
  /** 必胜策略下，本局最多还会经历的夜晚数（0 = 当前阶段即结束） */
  minNights: number
}

/**
 * 局势确定度：
 * - forced  真必然：一方必胜，且对手**任何**打法都赢不了 → 可提示可提前结束
 * - oneSided 单方必胜：一方有必胜策略，但对手仍有路径（要靠对方犯错）→ 99:1，不提示
 * - even   均势：双方都没有必胜策略
 */
export type CertaintyTier = "forced" | "oneSided" | "even"

export interface Certainty {
  tier: CertaintyTier
  /** forced / oneSided 的必胜方；even 为 null */
  winner: WinCamp | null
  /** oneSided 档的 1% 弱势方；其余为 null */
  underdog: Camp | null
  reason: string
  detail: string
  /**
   * 决定胜负的结构性事实：白天票数对比、狼人绕开放逐的手段、好人的一次性资源。
   * B 档用它解释「弱势方那点胜率到底靠什么」，避免只给一个孤零零的百分比。
   */
  facts: string[]
  minNights: number
}

// ===== 必然结束求解（minimax）=====

/** 夜晚可被狼人刀到的「好人单位」类型。同类单位彼此等价，只需按类型枚举刀口。 */
type Kind = "g" | "c" | "flipped" | "witch" | "guard" | "hunter" | "knight"

const KINDS: Kind[] = ["g", "c", "flipped", "witch", "guard", "hunter", "knight"]
const KIND_BIT: Record<Kind, number> = { g: 0, c: 1, flipped: 2, witch: 3, guard: 4, hunter: 5, knight: 6 }
/** 守卫「上晚守的是谁」共 8 种取值（7 类 + 没守） */
const GUARD_LAST_BITS = 3

/** 求解用的简化局面：只保留影响胜负与「能否翻盘」的信息 */
interface GoodNode {
  /** 存活狼人数 */
  w: number
  /** 普通神职（不含女巫/守卫/猎人/骑士/翻牌白痴） */
  g: number
  /** 普通平民 */
  c: number
  /** 翻牌后存活的白痴（0/1） */
  flipped: number
  witch: { antidote: boolean; poison: boolean; selfSave: boolean } | null
  /** 守卫；last = 上晚守的是哪一类（用于「不能连续两晚守同一人」） */
  guard: { last: Kind | null } | null
  /** 猎人存活且枪未哑火 */
  hunter: boolean
  /** 骑士存活且决斗未用 */
  knight: boolean
  /** 狼王存活且未被毒：被放逐后可开枪带走一人（被刀不会，狼人不会刀自己） */
  hasWk: boolean
  /** 白狼王存活：白天可自爆带走一人 */
  hasWwk: boolean
}

interface Result {
  /** 目标方是否必胜；reach 模式下表示「能否走到目标方获胜」 */
  win: boolean
  /** 该策略下本局最多还会经历的夜晚数 */
  nights: number
}

interface Ctx {
  /** 求解目标：是否存在该方的必胜策略 */
  target: Camp
  /**
   * 可达性模式：双方都配合，找「存在一条能走到目标方获胜的路径」。
   * 所有决策点都取 OR —— 用于区分 A 档（对手无路可走）与 B 档（对手仍有路径）。
   */
  reach: boolean
  /**
   * exists 模式：可达性搜索只问「能不能走到」，不需要最优 nights，
   * 因此所有 OR 聚合点命中即返回。可达性天然满足（isTargetCtrl 恒为 true），无需单开。
   */
  exists: boolean
  mode: WinMode
  /** 本次搜索的节点上限：可达性搜索分支更宽（双方失误都算路径），单独给更小的额度 */
  budgetLimit: number
}

/**
 * 夜晚数上限：每夜要么好人减员，要么消耗女巫药/守卫守人位，必然收敛；触顶即视为「不确定」。
 * 实测 3 夜以上才会分出胜负的局面极少，故取 4（比 6 快一个数量级）。
 */
const MAX_NIGHTS = 4
/**
 * 节点预算：求解在每次状态变化时同步跑，必须有硬上限，否则最重局面会卡 UI。
 * 超预算一律按「不确定」处理 —— 只漏报，不会误报。
 */
const NODE_BUDGET = 120_000
/**
 * 可达性搜索的独立预算。
 * exists 模式下所有决策点都取 OR，没有对手可剪枝，「确认无路径」只能靠穷尽整棵树；
 * 12 人屠城局（守卫/骑士/女巫/白痴同场）实测能吃掉 2 万+ 节点。
 * 额度用尽时不能当成「无路径」—— 那会把 B 档误报成 A 档 100%，方向错了。
 */
const REACH_BUDGET = 300_000

/** exists 模式命中：存在一条路径即可，nights 无意义 */
const EXISTS_WIN: Result = { win: true, nights: 0 }
/** dayNode 里标记「exists 模式已命中，可停止枚举」 */
const EARLY = -1

/** 目标方是否有路可走（无预算干扰时的纯逻辑判定） */
function isTargetCtrl(ctx: Ctx, ctrl: Controller): boolean {
  // 可达性模式下双方配合，任何决策点都只需找到一条可行分支
  return ctx.reach || ctrl === ctx.target
}

function godsOf(s: GoodNode): number {
  return s.g + (s.witch ? 1 : 0) + (s.guard ? 1 : 0) + (s.hunter ? 1 : 0) + (s.knight ? 1 : 0)
}

/** 平民桶：与 checkWin 口径一致，不含已翻牌的白痴（见 aliveCampCounts 注释） */
function civsOf(s: GoodNode): number {
  return s.c
}

/** 好人票数：翻牌白痴失去投票权 */
function votesOf(s: GoodNode): number {
  return godsOf(s) + s.c
}

function countOf(s: GoodNode, k: Kind): number {
  switch (k) {
    case "g":
      return s.g
    case "c":
      return s.c
    case "flipped":
      return s.flipped
    case "witch":
      return s.witch ? 1 : 0
    case "guard":
      return s.guard ? 1 : 0
    case "hunter":
      return s.hunter ? 1 : 0
    case "knight":
      return s.knight ? 1 : 0
  }
}

/** 移走一个该类好人（出局）。带技能的出局后技能一并失效。 */
function killOf(s: GoodNode, k: Kind): GoodNode {
  const n: GoodNode = { ...s }
  switch (k) {
    case "g":
      n.g--
      break
    case "c":
      n.c--
      break
    case "flipped":
      n.flipped = 0
      break
    case "witch":
      n.witch = null
      break
    case "guard":
      n.guard = null
      break
    case "hunter":
      n.hunter = false
      break
    case "knight":
      n.knight = false
      break
  }
  return n
}

function campOf(s: GoodNode): CampCounts {
  return { wolf: s.w, god: godsOf(s), civil: civsOf(s) }
}

/** 终局判定：true = 目标方已胜，false = 目标方已败，null = 未分胜负 */
function terminal(s: GoodNode, ctx: Ctx): boolean | null {
  const c = campOf(s)
  if (wolfWinNow(c, ctx.mode)) return ctx.target === "wolf"
  if (goodWinNow(c)) return ctx.target === "good"
  return null
}

/**
 * 目标方在剩余 depth 夜内**最多**能消除多少个对方单位（真实上限的下界）。
 * 用途是剪掉「数量上就不可能」的局面：12 人屠城局里狼人要把 9 个好人全部打光，
 * 不剪的话整棵子树会被完整展开（实测单局多花 200ms+）。
 *
 * 剪枝只在「结论确定为否」时使用，所以 capacity 宁可低估、不可高估 ——
 * 高估会把「其实还有路径」的局面误判成 A 档 100%，方向错了。
 * 每个昼夜轮回双方各能少 1 人（夜 1 刀 / 昼 1 放逐），所以先给 2 * depth。
 * 一次性机会：白狼王自爆带走 1 人、狼王被放逐后开枪带走 1 人、守卫同守自守自己出局，
 * 以及猎人开枪 / 骑士决斗 / 女巫毒各带走 1 狼。这几项都可能被对手「顺手配合」，
 * reach 模式下任何一方都可能出现失误，因此一律计入（曾漏算狼人自爆，导致 122 个盘从 B 误判成 A）。
 */
function maxEliminations(s: GoodNode, target: Camp, depth: number): number {
  const oneShot =
    target === "wolf"
      ? (s.hasWwk ? 1 : 0) + (s.hasWk ? 1 : 0) + (s.guard ? 1 : 0)
      : (s.hunter ? 1 : 0) + (s.knight ? 1 : 0) + (s.witch?.poison ? 1 : 0)
  return 2 * depth + 3 + oneShot
}

/** 目标方赢下这一局需要消灭多少个对方单位 */
function eliminationsNeeded(s: GoodNode, ctx: Ctx): number {
  if (ctx.target !== "wolf") return s.w
  const c = campOf(s)
  // 屠边打空任意一侧即可，屠城要两侧都打光
  return ctx.mode === "city" ? c.god + c.civil : Math.min(c.god, c.civil)
}

/** 数量上就已经够不到终局 → 无论怎么打都赢不了，直接判负 */
function outOfReach(s: GoodNode, ctx: Ctx, depth: number): boolean {
  return eliminationsNeeded(s, ctx) > maxEliminations(s, ctx.target, depth)
}

/** 守卫能否守这一类：不能连续两晚守同一人。同类多于一人时换一个人守是允许的（对好人有利，按此建模避免误报）。 */
function canGuard(s: GoodNode, k: Kind): boolean {
  if (!s.guard) return false
  if (s.guard.last !== k) return true
  return countOf(s, k) > 1
}

const FAIL: Result = { win: false, nights: 0 }

/** 夜晚入口：守卫先于狼人行动（夜晚步骤 守卫 → 狼人 → 女巫 → 预言家），守卫只能猜刀口。 */
function nightNode(ctx: Ctx, s: GoodNode, depth: number): Result {
  const t = terminal(s, ctx)
  if (t !== null) return { win: t, nights: 0 }
  if (depth <= 0) return FAIL
  if (outOfReach(s, ctx, depth)) return FAIL
  // 预算耗尽必须记账（与 dayNode 同理）：不记的话这个「算不完的 FAIL」会被
  // nightMemo 当成正常结论写进缓存，后面所有查询都读到它 —— 于是凭空多出
  // 一批「无翻盘路径」的 A 档，显示 0% 还能点提前结束。缓存键把 budgetLimit
  // 归一化成 0，forced(12 万) 与 reach(2.6 万) 两套预算共用同一批条目，
  // 所以 forced 侧的耗尽会顺着缓存流到 reach 侧，污染必须在这里堵死。
  if (--budget <= 0) {
    budgetHits++
    return FAIL
  }

  const or = isTargetCtrl(ctx, "good")
  let best: number | null = null

  if (or) {
    // 守卫决策归目标方掌控（reach 模式下双方配合）。这里同时有两个量词，别弄混：
    //
    // - 守卫守谁：OR。只枚举「空守」与「正好守住本刀口」两类，把「守了一个没被刀的人」整类略去：
    //   它与空守的差别只有 guard.last，而那只会锁死守卫自己下一晚的守人选择，后续分支是
    //   空守的子集 —— 不可能构成通往胜利的唯一一条路。7 种守法 × 7 个刀口由 49 组合降到 14。
    // - 狼人刀谁：归对手掌控时是 AND（换个刀口就能破掉必胜策略，每个刀口都得赢）；
    //   reach 模式或目标本身就是狼人时是 OR。
    const killOr = isTargetCtrl(ctx, "wolf")

    // 这里曾经还枚举「狼人整夜空刀」，现已从 reach 搜索中剔除：见文件头「B 档判据」一节。
    // 空刀对狼人永远是送分（狼人有刀口就必胜的局面，空刀等于白送一晚），
    // 把它算进翻盘路径会让「3 狼 2 好」这种必输局面显示成 8%。

    for (const k of KINDS) {
      if (countOf(s, k) === 0) continue
      // 该刀口下，守卫最优守法对应的夜晚数
      let kBest: number | null = null
      const prots: (Kind | null)[] = s.guard && canGuard(s, k) ? [null, k] : [null]
      for (const prot of prots) {
        const r = killNode(ctx, s, k, prot, depth)
        if (!r.win) continue
        if (killOr && ctx.exists) return EXISTS_WIN
        if (kBest === null || r.nights < kBest) kBest = r.nights
      }
      if (kBest === null) {
        if (!killOr) return FAIL // 狼人改刀口即可破掉目标方的必胜策略
        continue
      }
      // AND 取各刀口里最慢的（狼人会挑最能拖的那一刀），OR 取最快的
      if (best === null || (killOr ? kBest < best : kBest > best)) best = kBest
    }
  } else {
    // 目标方是狼人 → 守卫决策归对手掌控。量词顺序是 **∀p ∃k**：
    // 守卫先行动、看不到刀口，狼人看到守谁之后才决定刀谁。
    // 所以外层对守法取 max（对手挑最能拖的），内层对刀口取 min（狼人挑最快赢的那一刀）。
    // 内层是 OR：某个刀口让目标方输就跳过它，狼人改刀口即可 —— 不能因为一个刀口输就判整夜输。
    //
    // 省枚举的关键：「守了一个没被刀的人」与空守的子状态**完全相同**
    // （guard.last 只在守中时才更新，见 killNode），两者算出来是同一个值。
    // 于是每个守法人 p 只有 k === p 那一个格子需要真算，其余直接复用 p = null 那一行：
    // 7 次（空守行）+ 7 次（对角线）= 14 次 killNode，而不是 8 × 7 = 56 次。
    const nullRow = new Map<Kind, Result>()
    for (const k of KINDS) {
      if (countOf(s, k) === 0) continue
      nullRow.set(k, killNode(ctx, s, k, null, depth))
    }
    for (const prot of guardChoicesOf(s)) {
      let pBest: number | null = null
      for (const k of KINDS) {
        if (countOf(s, k) === 0) continue
        const r = prot === null || prot === k ? killNode(ctx, s, k, prot, depth) : nullRow.get(k)!
        if (!r.win) continue
        if (pBest === null || r.nights < pBest) pBest = r.nights
      }
      if (pBest === null) return FAIL
      if (best === null || pBest > best) best = pBest
    }
  }
  if (best === null) return FAIL
  return { win: true, nights: best + 1 }
}

/** 守卫可选的全部守法：空守 + 每个当前能守的类型 */
function guardChoicesOf(s: GoodNode): (Kind | null)[] {
  const out: (Kind | null)[] = [null]
  for (const k of KINDS) {
    if (countOf(s, k) > 0 && canGuard(s, k)) out.push(k)
  }
  return out
}

/** 刀口落地 → 女巫行动 → 结算死亡/开枪 → 进入白天 */
function killNode(ctx: Ctx, s: GoodNode, target: Kind, prot: Kind | null, depth: number): Result {
  // 守卫守中：目标存活。同守自守时守卫本人出局，刀口照样成立。
  const savedByGuard = prot !== null && prot === target && target !== "guard"
  // 女巫若被刀且没被守住，当夜就已经出局，不能再用药（logic.ts:1014 只能首夜自救）
  const witchSpent = target === "witch" && !savedByGuard

  // 女巫的所有最优选择（好人决策 → 目标方掌控取 OR，对手掌控取全枚举）
  const useSaveChoices: boolean[] =
    !witchSpent && !savedByGuard && s.witch?.antidote && (target !== "witch" || s.witch.selfSave) && prot !== target
      ? [false, true]
      : [false]
  const usePoisonChoices: boolean[] = !witchSpent && s.witch?.poison && s.w > 0 ? [false, true] : [false]

  // 女巫的毒只可能落在狼人身上：毒自己人永远是劣势选项，排除后对双方都是更严格的建模
  const or = isTargetCtrl(ctx, "good")
  let best: number | null = null
  for (const useSave of useSaveChoices) {
    for (const usePoison of usePoisonChoices) {
      // 同一夜不能既救又毒（logic.ts:1006 nightUsedDrug 互斥）
      if (useSave && usePoison) continue
      let n: GoodNode = { ...s }
      if (useSave && n.witch) n.witch = { ...n.witch, antidote: false, selfSave: false }
      if (usePoison && n.witch) {
        n.witch = { ...n.witch, poison: false }
        n.w-- // 好人最优：毒打狼人
      }
      const targetSurvives = savedByGuard || useSave
      if (!targetSurvives) n = outWithGun(killOf(n, target), target)
      // 守卫守中后，下一晚不能再守同一类人（logic.ts 同守自守规则）。
      // 漏了这一步，守卫就能每晚守同一个人，「不能连守」只在根节点生效一次。
      if (savedByGuard && n.guard) n = { ...n, guard: { last: target } }
      const r = dayMemo(ctx, n, depth)
      if (or) {
        if (!r.win) continue
        if (ctx.exists) return EXISTS_WIN
        if (best === null || r.nights < best) best = r.nights
      } else {
        if (!r.win) return FAIL
        if (best === null || r.nights > best) best = r.nights
      }
    }
  }
  return best === null ? FAIL : { win: true, nights: best }
}

/**
 * 好人单位出局后的结算：猎人/狼王出枪带走一名狼人。
 * 猎人属好人阵营，这一枪必然对准狼人；狼王弃枪是狼人自己的选择，由 wolfKingShotBest 单独枚举。
 * 「朝好人开枪」永远是劣势选项，排除后对目标方双方都是更严格的建模（不会造成误报）。
 */
function outWithGun(after: GoodNode, target: Kind): GoodNode {
  if (target !== "hunter" || after.w <= 0) return after
  return { ...after, w: after.w - 1 }
}

/**
 * 放逐一个人后狼王可能的开枪分支（狼王自主选择目标 → 狼人决策）。
 * 狼王可弃枪，所以开枪全输时还要看弃枪。
 */
function wolfKingShotBest(ctx: Ctx, afterKingOut: GoodNode, cont: (n: GoodNode) => Result): Result | null {
  const or = isTargetCtrl(ctx, "wolf")
  let best: number | null = null
  for (const k of KINDS) {
    if (countOf(afterKingOut, k) === 0) continue
    let m = killOf(afterKingOut, k)
    // 狼枪带走猎人：猎人未被毒仍可开枪（好人再打一枪）。狼人不会选这支，枚举无害
    if (k === "hunter" && afterKingOut.hunter && m.w > 0) m = { ...m, w: m.w - 1 }
    const r = cont(m)
    if (or) {
      if (!r.win) continue
      if (ctx.exists) return EXISTS_WIN
      if (best === null || r.nights < best) best = r.nights
    } else {
      if (!r.win) return null
      if (best === null || r.nights > best) best = r.nights
    }
  }
  const giveUp = cont(afterKingOut)
  if (or) {
    if (giveUp.win) {
      if (ctx.exists) return EXISTS_WIN
      if (best === null || giveUp.nights < best) best = giveUp.nights
    }
  } else {
    if (!giveUp.win) return null
    if (best === null || giveUp.nights > best) best = giveUp.nights
  }
  return best === null ? null : { win: true, nights: best }
}

/**
 * 放逐猎人：猎人出局后会开枪（finishVote → hunterShotPending），枪口必然对准狼人。
 * 猎人属好人阵营，这一枪对狼人一定不利——漏算就会把「放逐猎人」误当成白送的好人减员，造成误报。
 */
function exileHunter(s: GoodNode): GoodNode {
  return outWithGun({ ...s, hunter: false }, "hunter")
}

/**
 * 白天阶段。
 *
 * 真实规则（logic.ts finishVote / wolfBaoZha / wolfKingBaoZha / wolfKingShootConfirm）：
 * - 投票由票数决定：好人票 > 狼数 → 好人能强制放逐一个狼人；好人票 < 狼数 → 狼人挑目标。
 * - **平票（好人票 = 狼数）由法官指定任意存活玩家出局**（finishVote 只校验目标合法，不校验票数归属），
 *   没有任何一方能掌控结果，因此按「无人可控」建模：forced 模式要求所有裁决都利好目标方才算必胜。
 * - 放逐目标合法：除「已翻牌白痴」不可被放逐外，所有存活玩家都可以。
 * - 放逐狼王 → 狼王可开枪带走一人（也可弃枪）；放逐猎人 → 猎人开枪带走狼人；
 *   放逐未翻牌白痴 → 翻牌免死（移出神/民桶且失去投票权，与放逐一名神职对桶与票数的影响等价，
 *   故并入「放逐好人」枚举，不单列）。
 * - 狼人白天可随时自爆跳过投票（wolfBaoZha）；白狼王自爆还能带走一人（wolfKingBaoZha）。
 *   自爆不受票数约束，是狼人绕开放逐的手段，必须计入。
 *
 * 语义：每个决策点按控制方取量词 —— 目标方掌控取 OR（任一选项能赢即可），
 * 对手或法官掌控取 AND（所有选项都必须赢）。
 */
function dayNode(ctx: Ctx, s: GoodNode, depth: number): Result {
  const t = terminal(s, ctx)
  if (t !== null) return { win: t, nights: 0 }
  if (--budget <= 0) {
    budgetHits++
    return FAIL
  }
  // 放逐/自爆之后进入下一夜
  const nextNightOf = (n: GoodNode) => nightMemo(ctx, n, depth - 1)

  /**
   * 是否跳过某个选项：
   * - 目标方掌控该决策点时，「立刻让对手获胜」是劣势选项，可以跳过（理性人不会选）；
   * - 对手/法官掌控时必须照算 —— 对手恰恰会挑那个让目标方输的选项，跳过会造成误报。
   */
  const skipLosing = (ctrl: Controller, n: GoodNode): boolean => isTargetCtrl(ctx, ctrl) && terminal(n, ctx) === false

  if (outOfReach(s, ctx, depth)) return FAIL

  const votes = votesOf(s)
  let best: number | null = null
  /** 提交一个决策分支；返回 false 表示「对手/法官掌控的决策点已确定失败」，可停止枚举 */
  const offer = (ctrl: Controller, r: Result | null): boolean => {
    if (isTargetCtrl(ctx, ctrl)) {
      if (r && r.win) {
        if (ctx.exists) {
          best = EARLY
          return false
        }
        if (best === null || r.nights < best) best = r.nights
      }
      return true
    }
    if (!r || !r.win) return false
    if (best === null || r.nights > best) best = r.nights
    return true
  }
  /** offer 返回 false 有两种含义：exists 命中（赢），或对手掌控的决策点已确定失败 */
  const bail = (): Result => (best === EARLY ? EXISTS_WIN : FAIL)

  // ① 狼人手段（狼人决策）：自爆 / 白狼王自爆带走一人
  //
  // 只在 forced 搜索里枚举。自爆对狼人是「自己少一个、跳过一轮投票」的买卖，
  // 它能赢的场景 forced 已经算得到；但在 reach 搜索里它只会给弱势方白送一条翻盘路
  // （好人视角：狼人自爆 = 免费少一个狼），所以这里用 !ctx.reach 门掉。见文件头「B 档判据」。
  if (!ctx.reach && s.w > 0) {
    // 普通自爆：自己出局换「白天无人被放逐」。自爆即死光狼人时狼人必败，不理性，跳过
    if (s.w > 1) {
      const bombed: GoodNode = { ...s, w: s.w - 1, hasWwk: false, hasWk: false }
      if (!skipLosing("wolf", bombed)) offer("wolf", nextNightOf(bombed))
    }
    // 白狼王自爆带走一人：白狼王出局 + 好人减员（狼人自选目标）
    if (s.hasWwk) {
      const bombed: GoodNode = { ...s, w: s.w - 1, hasWwk: false, hasWk: false }
      if (!skipLosing("wolf", bombed)) {
        offer("wolf", nextNightOf(bombed)) // 不带人自爆
        for (const k of KINDS) {
          if (countOf(s, k) === 0) continue
          const n = killOf(bombed, k)
          if (skipLosing("wolf", n)) continue
          offer("wolf", nextNightOf(n))
        }
      }
    }
    if (best === EARLY) return EXISTS_WIN
  }

  // ② 投票
  if (votes > s.w) {
    // 好人票数占优：放逐目标由好人自选（好人决策）
    for (const br of goodExileBranches(ctx, s)) {
      const r = br.wkOut ? wolfKingShotBest(ctx, br.n, nextNightOf) : nextNightOf(br.n)
      if (!offer("good", r)) return bail()
    }
  } else if (votes < s.w) {
    // 狼人票数占优：放逐目标由狼人自选（狼人决策）
    offer("wolf", nextNightOf(s)) // 无人出局也是留给狼人的合法结果
    for (const k of KINDS) {
      if (countOf(s, k) === 0) continue
      if (k === "flipped") continue // 已翻牌白痴不可被放逐
      const n = k === "hunter" ? exileHunter(s) : killOf(s, k)
      if (skipLosing("wolf", n)) continue
      offer("wolf", nextNightOf(n))
    }
  } else {
    // 平票：法官指定任意存活玩家出局 —— 包含狼人。
    // 漏掉「法官放逐狼人」这个选项会让狼人必胜被误报（对目标方取 AND 时，
    // 少一个能让目标方输的选项，就等于凭空送给目标方一个必胜策略）。
    // 法官是第三方，forced 模式对双方都取 AND：全部裁决都要利好目标方才算必胜。
    const branches: Array<{ n: GoodNode; wkOut: boolean }> = []
    for (const k of KINDS) {
      if (countOf(s, k) === 0) continue
      if (k === "flipped") continue // 已翻牌白痴不可被放逐
      branches.push({ n: k === "hunter" ? exileHunter(s) : killOf(s, k), wkOut: false })
    }
    const specialWolves = (s.hasWk ? 1 : 0) + (s.hasWwk ? 1 : 0)
    if (s.w > specialWolves) branches.push({ n: { ...s, w: s.w - 1 }, wkOut: false })
    // 狼王被放逐后可以开枪带走好人（也可以弃枪）→ 狼人自主选择
    if (s.hasWk) branches.push({ n: { ...s, w: s.w - 1, hasWk: false }, wkOut: true })
    if (s.hasWwk) branches.push({ n: { ...s, w: s.w - 1, hasWwk: false }, wkOut: false })
    for (const br of branches) {
      const r = br.wkOut ? wolfKingShotBest(ctx, br.n, nextNightOf) : nextNightOf(br.n)
      if (!offer("judge", r)) return bail()
    }
  }

  // ③ 骑士决斗：好人可主动戳狼，也可以不戳（好人决策）
  if (s.knight) {
    for (const duel of [false, true]) {
      const n: GoodNode = duel ? { ...s, w: s.w - 1, knight: false } : s
      if (!offer("good", nextNightOf(n))) return bail()
    }
  }

  if (best === EARLY) return EXISTS_WIN
  if (best === null) return FAIL
  return { win: true, nights: best }
}

/**
 * 好人票数占优时好人的全部合法放逐选择。
 * wkOut 标记「放逐的是狼王」——他的开枪是狼人自主选择，单独按狼人决策处理。
 */
function goodExileBranches(ctx: Ctx, s: GoodNode): Array<{ n: GoodNode; wkOut: boolean }> {
  const out: Array<{ n: GoodNode; wkOut: boolean }> = []
  const specialWolves = (s.hasWk ? 1 : 0) + (s.hasWwk ? 1 : 0)
  // 放逐普通狼人
  if (s.w > specialWolves) out.push({ n: { ...s, w: s.w - 1 }, wkOut: false })
  // 放逐狼王：出局后可能开枪带走好人
  if (s.hasWk) out.push({ n: { ...s, w: s.w - 1, hasWk: false }, wkOut: true })
  // 放逐白狼王：出局即死，不能自爆带走
  if (s.hasWwk) out.push({ n: { ...s, w: s.w - 1, hasWwk: false }, wkOut: false })
  // 放逐猎人：猎人出局并开枪带走一名狼人（好人最优：打狼）
  if (s.hunter) out.push({ n: exileHunter(s), wkOut: false })
  // 可达性模式补齐「放逐好人」：好人放逐错人才是弱势方翻盘的典型路径，
  // forced 模式省略它对目标方更严格（好人只可能放逐狼人）。
  if (ctx.reach) {
    const blunders: Array<{ n: GoodNode; wkOut: boolean }> = []
    for (const k of KINDS) {
      if (k === "flipped" || k === "hunter" || countOf(s, k) === 0) continue
      blunders.push({ n: killOf(s, k), wkOut: false })
    }
    // 失误分支排在最前：可达性搜索只问「有没有路径」，而路径几乎都藏在某一方打错的那一手里
    // （好人放逐好人 / 狼人空刀）。exists 模式命中即返回，排前面能把整棵子树省掉。
    if (ctx.exists) return [...blunders, ...out]
    out.push(...blunders)
  }
  return out
}

const SPECIAL: Record<string, Kind> = {
  女巫: "witch",
  守卫: "guard",
  猎人: "hunter",
  骑士: "knight",
  白痴: "g",
}

/** 真实局面 → 求解节点 */
function toNode(state: GameState): GoodNode {
  const alive = state.players.filter((p) => p.alive)
  const find = (role: string) => alive.find((p) => p.role === role)

  const witchP = find("女巫")
  const guardP = find("守卫")
  const hunterP = find("猎人")
  const knightP = find("骑士")
  const wkP = find("狼王")
  const wwkP = find("白狼王")

  let g = 0
  let c = 0
  let flipped = 0
  for (const p of alive) {
    if (isWolfRole(p.role)) continue
    const special = SPECIAL[p.role]
    if (special === "witch" || special === "guard" || special === "hunter" || special === "knight") continue
    if (p.role === "白痴") {
      if (p.mark.idiotFlipped) flipped++
      else g++
      continue
    }
    const role = getRoleInstance(p.role)
    if (role?.def.camp === "god") g++
    else if (role?.def.camp === "villager") c++
  }

  // 守卫上晚守的是谁 → 归到哪一类（同类多人时按「换人守」处理，见 canGuard）
  let guardLast: Kind | null = null
  if (guardP && state.guardLastTarget) {
    const lastName = state.guardLastTarget
    guardLast = SPECIAL[lastName] ?? null
    const lastP = state.players.find((p) => p.name === lastName)
    if (lastP) {
      const r = getRoleInstance(lastP.role)
      if (lastP.role === "白痴" && lastP.mark.idiotFlipped) guardLast = "flipped"
      else if (r?.def.camp === "villager") guardLast = "c"
    }
  }

  return {
    w: alive.filter((p) => isWolfRole(p.role)).length,
    g,
    c,
    flipped,
    witch: witchP
      ? {
          antidote: !state.witchSaveUsed,
          poison: !state.witchPoisonUsed,
          selfSave: state.round <= 1,
        }
      : null,
    guard: guardP ? { last: guardLast } : null,
    hunter: !!hunterP && !hunterP.mark.hunterIsPoisoned,
    knight: !!knightP && !state.knightDuelUsed,
    hasWk: !!wkP && !wkP.mark.wolfKingIsPoisoned,
    hasWwk: !!wwkP,
  }
}

const cache = new Map<number, Result>()
/**
 * 缓存容量上限。一次搜索访问的节点数不超过节点预算（12 万），
 * 上限若低于预算就会在搜索中途 clear，把已算过的子树全部丢掉再算一遍 ——
 * 实测这会让最重局面的耗时在 150~210ms 之间剧烈抖动。给到预算之上即可避免中途清空。
 */
const CACHE_MAX = 150_000

/**
 * 记忆化键：把 GoodNode + 搜索上下文压成一个整数。
 *
 * 求解树里每个节点都要算一次键，用 JSON.stringify 拼字符串是纯浪费。
 *
 * 用混合基数而不是位运算：位段一旦排错就会静默撞键（原来 `flipped << 12` 和女巫的
 * `<< 13` 就重叠了 —— 2 个已翻牌白痴和「1 个白痴 + 女巫活着」会算出同一个键）。
 * 基数写法只要求每个字段的值不越过自己的基数，写错会立刻看出来而不是悄悄污染缓存。
 *
 * 字段与基数：狼/神/民各 4 位，翻牌白痴 2 位，女巫 4 位，守卫 4 位，
 * 四个单标志合并成 5 位（猎人/骑士/狼王/白狼王/量词），depth 3 位。
 * 最大值 2^30 上下，双精度整数完全精确，不存在浮点取整问题。
 */
const KEY_RADIX = { w: 16, g: 16, c: 16, flipped: 4, witch: 16, guard: 16, flags: 32, depth: 8 } as const

function packKey(ctx: Ctx, s: GoodNode, depth: number, atNight: boolean): number {
  const witchBits = s.witch ? 1 | (s.witch.antidote ? 2 : 0) | (s.witch.poison ? 4 : 0) | (s.witch.selfSave ? 8 : 0) : 0
  const guardBits = s.guard ? 1 + (s.guard.last === null ? 0 : 1 + KIND_BIT[s.guard.last] * 2) : 0
  const flags =
    (s.hunter ? 1 : 0) |
    (s.knight ? 2 : 0) |
    (s.hasWk ? 4 : 0) |
    (s.hasWwk ? 8 : 0) |
    (ctx.reach ? 16 : 0) |
    (ctx.target === "wolf" ? 32 : 0) |
    (ctx.mode === "city" ? 64 : 0) |
    (ctx.exists ? 128 : 0) |
    (atNight ? 256 : 0)
  let k = s.w
  k = k * KEY_RADIX.g + s.g
  k = k * KEY_RADIX.c + s.c
  k = k * KEY_RADIX.flipped + s.flipped
  k = k * KEY_RADIX.witch + witchBits
  k = k * KEY_RADIX.guard + guardBits
  k = k * KEY_RADIX.flags + flags
  return k * KEY_RADIX.depth + depth
}

/** 仅供测试：验证记忆化键的字段编码不会互相撞键 */
export function __packKeyForTest(node: GoodNode, depth: number, atNight: boolean, mode: WinMode = "edge"): number {
  return packKey({ target: "wolf", reach: false, exists: false, mode, budgetLimit: 0 }, node, depth, atNight)
}

/** 剩余可访问节点数（每次顶层求解重置） */
let budget = 0

/** 预算耗尽触发次数：用来判断某个子树的结果是否「算完了」，没算完的不入缓存 */
let budgetHits = 0

/** 仅供测试：清空求解缓存 */
export function clearForcedWinCache(): void {
  cache.clear()
  topCache = null
}

function putCache(key: number, r: Result): void {
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, r)
}

/**
 * 子树记忆化。求解树里大量子问题是重复的（好人/狼人枚举会反复落到同一个局面），
 * 不缓存就会退化成整树遍历，最重局面要几百毫秒，卡住 UI 同步计算。
 * 键里带 depth：结果受剩余夜晚上限影响；带 target/reach：量词不同结果不同。
 * 预算耗尽导致的结果是「不确定」，绝不能入缓存，否则会污染后续求解。
 */
function nightMemo(ctx: Ctx, s: GoodNode, depth: number): Result {
  if (depth <= 0) return FAIL
  const key = packKey(ctx, s, depth, true)
  const hit = cache.get(key)
  if (hit) return hit
  const h0 = budgetHits
  const r = nightNode(ctx, s, depth)
  if (budgetHits === h0) putCache(key, r)
  return r
}

function dayMemo(ctx: Ctx, s: GoodNode, depth: number): Result {
  const key = packKey(ctx, s, depth, false)
  const hit = cache.get(key)
  if (hit) return hit
  const h0 = budgetHits
  const r = dayNode(ctx, s, depth)
  if (budgetHits === h0) putCache(key, r)
  return r
}

/**
 * 求解入口。startAt 必须是「当前对局下一个待执行的动作」：
 * - phase === "night"：守卫/狼人/女巫尚未表态，从夜晚开始算
 * - phase === "day"：投票尚未发生，从白天放逐开始算（先投票再入夜）
 * 白天局先入夜再投票是反的，会把「好人现在就能放逐出狼人」的局面误判成狼人必胜。
 */
function solveFrom(ctx: Ctx, node: GoodNode, startAt: "night" | "day"): Result {
  budget = ctx.budgetLimit
  budgetHits = 0
  return startAt === "day" ? dayMemo(ctx, node, MAX_NIGHTS) : nightMemo(ctx, node, MAX_NIGHTS)
}

/** 目标方是否存在必胜策略（forced 模式：对手每个决策点都要输） */
function hasForcedStrategy(state: GameState, node: GoodNode, target: Camp): Result | null {
  const ctx: Ctx = { target, reach: false, exists: false, mode: state.winMode, budgetLimit: NODE_BUDGET }
  const r = solveFrom(ctx, node, state.phase === "day" ? "day" : "night")
  return r.win ? r : null
}

/**
 * 目标方是否**存在一条**获胜路径（reach 模式：双方配合，任何决策点都只需找到一条可行分支）。
 * 返回三态：
 * - true  找到路径 → B 档（弱势方要靠对方犯错）
 * - false 穷尽搜索确认无路径 → A 档 100%
 * - null  预算用尽、结论不可靠 → 保守按「可能还有路径」处理，绝不误报 A 档
 */
function canReachWin(state: GameState, node: GoodNode, target: Camp): boolean | null {
  const ctx: Ctx = { target, reach: true, exists: true, mode: state.winMode, budgetLimit: REACH_BUDGET }
  const r = solveFrom(ctx, node, state.phase === "day" ? "day" : "night")
  // 预算用尽说明这棵树没被完整看过，「无路径」不可信 → 交给上层按 B 档处理，绝不误报 A 档
  //
  // 注意夜晚上限（MAX_NIGHTS）触顶不计入：那是刻意的「翻盘窗口」产品决策 ——
  // 4 夜之内翻不了盘就按没有翻盘路径算，与「算不完」是两回事。
  if (budgetHits > 0) return null
  return r.win
}

function delaysOf(s: GoodNode): string[] {
  const out: string[] = []
  if (s.guard) out.push("守卫先行动只能猜刀口")
  if (s.witch?.antidote) out.push("解药仅 1 次")
  if (s.witch?.poison) out.push("毒药仅 1 次")
  if (s.hunter) out.push("猎人枪死后才开")
  if (s.knight) out.push("骑士决斗仅 1 次")
  return out
}

/** 狼人白天能绕开放逐的手段（求解已计入，这里只是告诉人为什么「票数占优」也没用） */
function wolfDayMoves(s: GoodNode): string[] {
  const out: string[] = []
  if (s.w > 1) out.push("狼人可自爆跳过投票")
  if (s.hasWwk) out.push("白狼王可自爆带走一人")
  if (s.hasWk) out.push("狼王被放逐后还能开枪带走一人")
  return out
}

const CAMP_NAME: Record<Camp, string> = { wolf: "狼人", good: "好人" }

function voteSummary(s: GoodNode): string {
  const votes = votesOf(s)
  if (votes > s.w) return `好人票数 ${votes} 占优，放逐狼人、猎人开枪、狼王弃枪都救不回来`
  if (votes < s.w) return `好人票数 ${votes} < 狼人 ${s.w}，白天放逐不出狼人，狼人想放逐谁就放逐谁`
  return `好人票数 ${votes} 与狼人 ${s.w} 持平，平票由法官指定出局者`
}

function endPhrase(nights: number, phase: string): string {
  if (nights <= 0) return phase === "day" ? "本轮白天即分胜负" : "今夜即分胜负"
  return `最多再 ${nights} 夜必然结束`
}

/** 组装 detail：A 档与 B 档共用同一套事实描述，只在结尾区分「无路可走」与「仍有路径」 */
function buildDetail(
  node: GoodNode,
  res: Result,
  state: GameState,
  favored: Camp,
  underdog: Camp | null,
): string {
  const where = `${node.w} 狼 / ${godsOf(node)} 神 / ${civsOf(node)} 民`
  const day = favored === "wolf" ? wolfDayMoves(node) : []
  const dayPart = day.length ? `；${day.join("、")}` : ""
  const delay = delaysOf(node)
  const delayPart = delay.length ? `；${delay.join("、")}，只能拖延，改变不了结局` : ""
  const head = `存活 ${where}。${voteSummary(node)}${dayPart}${delayPart}。`
  if (!underdog) {
    const loser = favored === "wolf" ? "good" : "wolf"
    return `${head}${CAMP_NAME[favored]}有必胜打法，${CAMP_NAME[loser]}已无翻盘路径。${endPhrase(res.nights, state.phase)}`
  }
  return `${head}${CAMP_NAME[favored]}有必胜打法，但${CAMP_NAME[underdog]}仍有一条翻盘路径（要靠${CAMP_NAME[favored]}犯错）。${endPhrase(res.nights, state.phase)}`
}

/**
 * 把 detail 里的事实部分单独拆出来给界面用：票数对比 + 狼人绕开放逐的手段 + 好人的一次性资源。
 * 与 buildDetail 用的是同一批 helper，两边不会各说各话；detail 的正文保持原样不动。
 */
function buildFacts(node: GoodNode, favored: Camp): string[] {
  const day = favored === "wolf" ? wolfDayMoves(node) : []
  return [voteSummary(node), ...day, ...delaysOf(node)]
}

// ===== 顶层结论 =====

/** 前置判定：把「已经分出胜负 / 第三方」这类不需要搜索的情况直接变成结论 */
function trivialCertainty(state: GameState): Certainty | null {
  const alivePlayers = state.players.filter((p) => p.alive)
  const counts = aliveCampCounts(state)
  const chain = getChainType(state)
  const hasThird = chain === "WG"
  const thirdAlive = alivePlayers.filter((p) => isThirdMember(state, p))

  // ① 狼全灭 → 好人必胜
  if (counts.wolf === 0) {
    return {
      tier: "forced",
      winner: "good",
      underdog: null,
      reason: "所有狼人已出局",
      detail: "场上已无存活狼人，好人阵营必胜",
      facts: [],
      minNights: 0,
    }
  }
  // ② 无好人存活 → 狼人必胜
  if (counts.god + counts.civil === 0 && thirdAlive.length === 0) {
    return {
      tier: "forced",
      winner: "wolf",
      underdog: null,
      reason: "无好人存活",
      detail: "场上已无存活好人，狼人阵营必胜",
      facts: [],
      minNights: 0,
    }
  }
  // ③ 仅剩第三方成员 → 第三方必胜
  if (hasThird && thirdAlive.length > 0 && alivePlayers.length === thirdAlive.length) {
    return {
      tier: "forced",
      winner: "third",
      underdog: null,
      reason: "仅剩第三方成员",
      detail: "场上仅剩丘比特与人狼情侣，第三方阵营必胜",
      facts: [],
      minNights: 0,
    }
  }
  // ④ 第三方与平民票数僵持 → 平局
  if (hasThird && counts.wolf === 0) {
    const aliveNonThird = alivePlayers.filter((p) => !isThirdMember(state, p))
    const onlyCivil = aliveNonThird.every((p) => {
      const role = getRoleInstance(p.role)
      return !!role && role.def.camp === "villager"
    })
    if (onlyCivil && aliveNonThird.length <= thirdAlive.length) {
      return {
        tier: "forced",
        winner: "draw",
        underdog: null,
        reason: "第三方与平民僵持",
        detail: "第三方人数不少于平民，票数与存活僵持，无法继续放逐",
        facts: [],
        minNights: 0,
      }
    }
  }
  // ⑤ 第三方仍在场时不求解：情侣未死前好/狼都不判胜，交给 checkWin 的第三方分支
  if (hasThird && thirdAlive.length > 0) return EVEN
  // ⑥ 双方都还有存活单位 → 需要 minimax
  return null
}

const EVEN: Certainty = { tier: "even", winner: null, underdog: null, reason: "", detail: "", facts: [], minNights: 0 }

/** 顶层结论缓存：面板与胜率预测会在同一轮渲染里各调一次，命中即可省掉一半搜索 */
let topCache: { key: string; value: Certainty } | null = null

/**
 * 局势确定度分析（三档）：
 * - 先找「有必胜策略」的一方（先狼后好，短路）；
 * - 找到了再看对手是否**仍有**获胜路径：有 → B 档（99:1），没有 → A 档（100:0，可提前结束）；
 * - 两边都没有必胜策略 → C 档均势。
 */
export function analyzeCertainty(state: GameState): Certainty {
  // 前置条件与 checkWin 完全一致：必须「全部角色分配完毕 + 对局已开始」，否则不检测
  if (!isGameStarted(state)) return EVEN

  const trivial = trivialCertainty(state)
  if (trivial) return trivial

  const node = toNode(state)
  const key = `${state.winMode}|${state.phase}|${JSON.stringify(node)}`
  if (topCache && topCache.key === key) return topCache.value

  /**
   * 先测更可能占优的一方（好人票数占优就先测好人）。
   *
   * 「某方有必胜策略」一旦成立，另一方必然没有 —— 同一个叶子上不可能双方都赢，
   * 所以命中即可省掉对手那一次搜索。而两次搜索里贵的是「证明某方没有必胜策略」：
   * 那要穷举对手的每一种打法，正是最慢的一步。先测占优方等于先要答案、后做穷举。
   */
  const goodFirst = votesOf(node) > node.w
  const order: Camp[] = goodFirst ? ["good", "wolf"] : ["wolf", "good"]

  let value: Certainty = EVEN
  for (let i = 0; i < order.length; i++) {
    const camp = order[i]
    const forced = hasForcedStrategy(state, node, camp)
    if (!forced) continue
    const other = order[i === 0 ? 1 : 0]
    // null = 可达性搜索预算用尽、结论不可靠；与 true 同等处理，宁可少报 A 也不误报 100%
    const underdogHasPath = canReachWin(state, node, other) !== false
    value = underdogHasPath
      ? {
          tier: "oneSided",
          winner: camp,
          underdog: other,
          reason:
            camp === "wolf" ? "狼人占优（好人需等狼人犯错）" : "好人占优（狼人需等好人犯错）",
          detail: buildDetail(node, forced, state, camp, other),
          facts: buildFacts(node, camp),
          minNights: forced.nights,
        }
      : {
          tier: "forced",
          winner: camp,
          underdog: null,
          reason: camp === "wolf" ? "狼人必胜（已无翻盘路径）" : "好人必胜（已无翻盘路径）",
          detail: buildDetail(node, forced, state, camp, null),
          facts: buildFacts(node, camp),
          minNights: forced.nights,
        }
    break
  }

  topCache = { key, value }
  return value
}

/**
 * 必然结束判定（**只返回 A 档真必然**）。
 * 先走第三方（丘比特人狼恋）两条特判，再交给 minimax：只有求解器证明
 * 「某方存在必胜策略 且 对手没有任何获胜路径」才返回结果，可用于提示与提前结束。
 * 女巫/守卫/猎人/骑士一律按好人的最优选择建模，不预设送分；平票由法官裁决，不预设狼人控票。
 */
export function solveForcedWin(state: GameState): ForcedWin | null {
  const c = analyzeCertainty(state)
  if (c.tier !== "forced" || !c.winner) return null
  return {
    detected: true,
    winner: c.winner,
    reason: c.reason,
    detail: c.detail,
    minNights: c.minNights,
  }
}

/** 供胜率预测使用：拿到 1% 弱势方（B 档） */
export function underdogOf(state: GameState): Camp | null {
  return analyzeCertainty(state).underdog
}
