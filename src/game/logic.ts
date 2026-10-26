import { roleIds, getRole } from "./roles/registry"
import type { DieReason } from "./roles/types"
export {
  setJingHui,
  autoTransferJingHui,
  loseJingHui,
  transferBadge,
  loseBadge,
  handleSheriffDeath,
  resolveBadgePending,
} from "./badge"
import { loseBadge } from "./badge"
export { getRoleInstance } from "./roles/builtin"
import { randomDefaultAvatar } from "@/assets/roles"

export const NO_CHECK = "__NOCHECK__"

/** 板子不再可选：固定 9 人标准（3狼+预言家+女巫+猎人+3平民），其它配置靠「加角色」微调 */
export const DEFAULT_BOARD = "9"

export const boardConfig: Record<string, string[]> = {
  "6a": ["狼人", "狼人", "预言家", "猎人", "平民", "平民"],
  "6b": ["狼人", "狼人", "预言家", "女巫", "平民", "平民"],
  "7a": ["狼人", "狼人", "预言家", "猎人", "平民", "平民", "平民"],
  "7b": ["狼人", "狼人", "女巫", "平民", "平民", "平民", "平民"],
  "8a": ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民"],
  "8b": ["狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "平民", "平民"],
  "9": ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民"],
  "10": ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民"],
  "11": ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "平民", "平民", "平民", "平民", "平民"],
  "12": ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "白痴", "平民", "平民", "平民", "平民"],
  "13": ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "白痴", "平民", "平民", "平民", "平民", "平民"],
  "12k": ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "骑士", "白痴", "平民", "平民", "平民", "平民"],
  "12q": ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "丘比特", "平民", "平民", "平民", "平民"],
  "13w": ["白狼王", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "白痴", "平民", "平民", "平民", "平民", "平民"],
}

/** 全部可选角色 id（由注册表派生，新增角色自动纳入） */
export const ALL_ROLE_OPT = roleIds()
/** 神职列表：注册表 camp==="god" 的角色（丘比特为第三方，不计神/民） */
export const GOD_LIST = roleIds().filter((id) => getRole(id)?.camp === "god")
/** 狼人阵营：注册表 camp==="wolf" 的角色（含白狼王、狼王） */
export function isWolfRole(role: string): boolean {
  return getRole(role)?.camp === "wolf"
}
/** 狼群成员：狼阵营且参与狼人会议/刀人（石像鬼、隐狼为 false，不在狼群） */
export function isWolfPackRole(role: string): boolean {
  const def = getRole(role)
  return def?.camp === "wolf" && def.wolfPack !== false
}

/**
 * 玩家当前生效阵营：野孩子黑化后视为狼，其余取角色注册表阵营（未分配返回 ""）。
 * 胜负/计分/查验等「按人判定阵营」的口径统一走这里。
 */
export function effectiveCampOf(p: { role: string; mark?: Mark }): string {
  // mark 允许缺失：历史对局记录（GameRecord.players）只有角色没有 mark，
  // 链型展示等只读场景不能因此崩溃。
  if (p.role === "野孩子" && p.mark?.isTransform) return "wolf"
  return getRole(p.role)?.camp ?? ""
}

/** 玩家当前是否为狼阵营（野孩子黑化计入；查验/计分/胜负共用） */
export function isEffectiveWolf(p: { role: string; mark?: Mark }): boolean {
  return effectiveCampOf(p) === "wolf"
}

/** 当前是否属于“狼群”（与狼同睁眼、参与狼刀）：狼群角色，或已黑化的野孩子 */
export function isEffectiveWolfPack(p: { role: string; mark?: Mark }): boolean {
  if (isWolfPackRole(p.role)) return true
  return p.role === "野孩子" && !!p.mark?.isTransform
}

/** 隐狼当前能否刀人：场上有存活隐狼，且除隐狼外无其他存活狼阵营玩家 */
export function hiddenWolfCanKnife(state: GameState): boolean {
  if (!state.players.some((p) => p.alive && p.role === "隐狼")) return false
  return !state.players.some((p) => p.alive && p.role !== "隐狼" && isEffectiveWolf(p))
}

/** 刷新隐狼刀人权标记（死亡/放逐/入夜等造成减员后调用） */
export function refreshHiddenWolfKnife(state: GameState): void {
  const can = hiddenWolfCanKnife(state)
  for (const p of state.players) {
    if (p.role === "隐狼") p.mark.hasKnife = can
  }
}
/** 唯一性角色：注册表 unique===true 的角色（每局至多 1 个） */
export const UNIQUE_ROLES = roleIds().filter((id) => getRole(id)?.unique)
/** 角色头像表情，一眼认出（由注册表派生） */
export const ROLE_EMOJI: Record<string, string> = Object.fromEntries(
  roleIds().map((id) => [id, getRole(id)?.emoji ?? ""]),
)
/** 角色简写（标签/紧凑场景展示用，完整名保留在 title/详情里） */
export const ROLE_SHORT: Record<string, string> = Object.fromEntries(
  roleIds().map((id) => [id, getRole(id)?.short ?? id]),
)

/** 夜间步骤完成标记初始值（由注册表派生；新增带夜间步骤的角色自动纳入） */
export function freshNightSteps(): Record<string, boolean> {
  const steps: Record<string, boolean> = {}
  for (const id of roleIds()) {
    const key = getRole(id)?.nightStep?.key
    if (key) steps[key] = false
  }
  return steps
}

/** 角色简写；未收录时回退为完整名（实时查注册表，动态注册的角色同样生效） */
export function roleShort(role?: string): string {
  if (role) {
    const def = getRole(role)
    if (def) return def.short
    return role
  }
  return ""
}

export const boardLabels: Record<string, string> = {
  "6a": "6人竞技｜2狼+预+猎+2民",
  "6b": "6人娱乐｜2狼+预+巫+2民",
  "7a": "7人竞技｜2狼+预+猎+3民",
  "7b": "7人娱乐｜2狼+巫+4民",
  "8a": "8人竞技预女猎｜3狼+预+巫+猎+2民",
  "8b": "8人预女猎守｜2狼+预+巫+猎+守+2民",
  "9": "9人标准预女猎｜3狼+预+巫+猎+3民",
  "10": "10人标准｜3狼+预+巫+猎+4民",
  "11": "11人标准｜3狼+预+巫+猎+5民",
  "12": "12人预女猎白｜4狼+预+巫+猎+痴+4民",
  "13": "13人预女猎白扩｜4狼+预+巫+猎+痴+5民",
  "12k": "12人预女猎骑白｜3狼+预+巫+猎+骑+痴+4民",
  "12q": "12人预女猎丘｜4狼+预+巫+猎+丘+4民",
  "13w": "13人白狼王｜白狼+3狼+预+巫+猎+痴+5民",
}

/** 板子简称：去掉人数/描述后缀，如 9→预女猎、12→预女猎白、13w→白狼王；无角色简称兜底显示 N人X */
export function boardShortName(board: string): string {
  const label = boardLabels[board]
  if (!label) return board
  let s = label.split("｜")[0]
  s = s.replace(/^\d+人/, "").replace(/^(标准|竞技|娱乐)/, "")
  return s || label.split("｜")[0]
}

export interface Mark {
  prophetCheckWolf: number
  prophetCheckGood: boolean
  prophetNoCheckCount: number
  witchSaveGood: boolean
  witchPoWolf: boolean
  witchPoGood: boolean
  hunterKillWolf: boolean
  hunterKillGood: boolean
  hunterIsPoisoned: boolean
  wolfKingShotGood: boolean
  wolfKingShotWolf: boolean
  wolfKingIsPoisoned: boolean
  /** 白狼王自爆带走的目标名（用于自爆带人计分，空=未自爆带人） */
  wolfBombTarget: string
  guardHitCount: number
  guardSameSaveKill: boolean
  wolfHanTiaoJinghui: boolean
  wolfSelfKillCheat: boolean
  idiotFlipped: boolean
  voteTarget: string
  voteWolfCount: number
  voteGoodCount: number
  /** 恶灵骑士：反伤是否已使用（整局一次性） */
  dreadKnightRevengeUsed: boolean
  /** 恶灵骑士：本夜是否被预言家查验（每夜重置） */
  dreadKnightCheckedTonight: boolean
  /** 恶灵骑士：本夜是否被女巫毒杀（每夜重置） */
  dreadKnightPoisonedTonight: boolean
  /** 恶灵骑士：反伤触发次数（计分用） */
  dreadKnightRevengeCount: number
  /** 恶灵骑士：是否曾被预言家查验（整局累计，计分用） */
  dreadKnightEverChecked: boolean
  /** 恶灵骑士：是否曾被女巫毒杀（整局累计，计分用） */
  dreadKnightEverPoisoned: boolean
  /** 恶灵骑士：反伤目标玩家名（空=未触发反伤） */
  dreadKnightRevengeTarget: string
  /** 恶灵骑士：曾被查验但该次查验未触发反伤（可叠加计分） */
  dreadKnightCheckNoRevenge: boolean
  /** 恶灵骑士：曾被毒杀但该次毒药未触发反伤（可叠加计分） */
  dreadKnightPoisonNoRevenge: boolean
  /** 石像鬼：本夜是否由石像鬼完成刀人（每夜重置） */
  gargoyleKilledTonight: boolean
  /** 本夜技能被封印/恐惧（噩梦之影恐惧神职；每夜重置） */
  skillDisabled: boolean
  /** 隐狼：当前是否具备刀人权（除隐狼外狼阵营全灭时 true，动态刷新） */
  hasKnife: boolean
  /** 野孩子：是否已黑化变身 */
  isTransform: boolean
  /** 野孩子：首夜选定的榜样玩家名 */
  roleModel: string
  /** 摄梦人：上一夜摄梦对象（连续两晚同梦触发连梦死亡） */
  prevDreamTarget: string
  /** 摄梦人：本夜成为梦游者（免疫夜间伤害；每夜重置） */
  dreamShield: boolean
  /** 血月使徒：被放逐但血月之力延续到天亮才死（期间可行动/自爆） */
  bloodDelayedExile: boolean
  /** 猎魔人：狩猎击杀狼次数 */
  huntWolfCount: number
  /** 猎魔人：狩猎误伤好人次数 */
  huntGoodCount: number
  /** 摄梦人：连梦击杀狼次数 */
  dreamKillWolf: number
  /** 摄梦人：连梦击杀好人次数 */
  dreamKillGood: number
  /** 噩梦之影：恐惧狼阵营目标次数（恐狼空刀 -1） */
  fearWolfCount: number
  /** 噩梦之影：恐惧神职目标次数（+0.5） */
  fearGodCount: number
  /** 噩梦之影：本夜恐惧是否已解析（首夜目标身份未确认时延迟到确认后） */
  fearResolved: boolean
  /** 炸弹人：炸弹炸死狼次数 */
  bombWolfCount: number
  /** 炸弹人：炸弹炸死好人次数 */
  bombGoodCount: number
  /** 血月使徒：自爆封印神职次数 */
  bloodSealCount: number
}

export interface Player {
  name: string
  no: number
  alive: boolean
  role: string
  scoreRound: number
  scoreTotal: number
  star: string
  scoreDetail: string[]
  mark: Mark
  /** 出局原因（""=未出局/旧存档）：vote/poison/wolfKill/selfBomb/duel/shot/lover 等 */
  deathReason?: DieReason | ""
  /** 默认头像（未分配角色时随机分配的 SVG 头像） */
  avatar?: string
}

export type WinCamp = "wolf" | "god" | "civil" | "third" | "draw" | null
/** 求解器口径的两方阵营（与 WinCamp 的历史叫法不同，这里单独定义避免混用） */
export type Camp = "wolf" | "good"
export type Phase = "idle" | "night" | "day"

export const DEFAULT_VOICES: Record<string, string> = {
  night_start: "天黑请闭眼。",
  cupid: "丘比特请睁眼！指认你选定的两位情侣，让大家感受爱情，看完赶紧闭眼。",
  cupid_close: "丘比特请闭眼。",
  lovers_meet: "被选中的情侣请睁眼，互相认识一下。",
  lovers_close: "情侣请闭眼。",
  wolf: "狼崽子睁眼！认认你的同伙，商量今晚刀哪个大冤种，密谋完赶紧闭眼装好人。",
  wolf_king_gesture: "狼王、白狼王请举手示意，法官确认！",
  charm: "狼美人请睁眼！今晚魅惑一个人，让他与你生死相随，选好赶紧闭眼。",
  charm_close: "狼美人请闭眼。",
  gargoyle: "石像鬼请睁眼，查看一名玩家的真实身份，看完闭眼。",
  gargoyle_assign: "石像鬼请睁眼，确认你的身份，看完闭眼。",
  gargoyle_close: "石像鬼请闭眼。",
  wolf_close: "狼人请闭眼。",
  prophet: "算命大仙请睁眼！扒开一位玩家的底牌，看完把嘴捂严实，闭眼！",
  prophet_close: "预言家请闭眼。",
  guard: "夜班保镖上线！记住别连续保同一个人，挑好保护对象麻溜闭眼。",
  guard_close: "守卫请闭眼。",
  witch: "药罐子女巫请睁眼！今晚被刀的是某玩家。救不救？毒药要不要给谁上点强度，想明白再闭眼。",
  witch_close: "女巫请闭眼。",
  gravekeeper: "守墓人请睁眼，得知昨日被投票放逐者属于好人还是狼人阵营。",
  gravekeeper_close: "守墓人请闭眼。",
  knight: "骑士请睁眼，确认你的决斗之剑还没出鞘。",
  knight_close: "骑士请闭眼。",
  hunter_open: "猎人请睁眼，确认你的枪状态，没问题就闭眼。",
  hunter_close: "猎人请闭眼。",
  idiot_open: "白痴请睁眼，确认身份，继续闭眼摸鱼。",
  idiot_close: "白痴请闭眼。",
  dawn: "天亮了，请睁眼！",
  dawn_peace: "天亮了，昨晚是平安夜！",
  death: "{nos}号玩家出局，bye-bye，下局见！",
  vote: "现在是投票环节，请投出你怀疑的人。",
  explode: "Boom！狼人自爆：直接摆烂摊牌，不演了！白天结束全体闭眼入夜。",
  hunter: "枪哥，猎枪已上膛，逮个倒霉蛋过来陪葬！",
  hunter_poisoned: "毒药直接把枪腐蚀锈死啦，彻底哑火开不了！",
  idiot_flip: "显眼包亮身份赖场不走！以后没投票权，白天投不死，只能夜里搞他。",
  knight_duel_wolf: "来决斗吧！骑士一剑戳中大灰狼！狼人直接寄，火速入夜！",
  knight_duel_good: "来决斗吧！骑士看走眼翻车，自己白给，继续盘！",
  wwk_boom: "Boom！白狼王掀桌自爆！顺手薅走一个，直接入夜。",
  jinghui: "现在竞选警长。",
  nightmare: "噩梦之影请睁眼！今晚恐吓一个人，让他从梦中惊醒！",
  nightmare_close: "噩梦之影请闭眼。",
  hiddenWolf: "隐狼请睁眼，确认你的身份，别声张，闭眼。",
  hiddenWolf_close: "隐狼请闭眼。",
  hunterWolf: "猎魔人请睁眼！选择一名玩家进行狩猎，天亮揭晓结果。",
  hunterWolf_close: "猎魔人请闭眼。",
  dreamer: "摄梦人请睁眼！进入一名玩家的梦境，连续两晚同梦将带来死亡。",
  dreamer_close: "摄梦人请闭眼。",
  wild_child: "野孩子请睁眼，看看你的榜样，记住他，闭眼。",
  wild_child_close: "野孩子请闭眼。",
  bomber_open: "炸弹人请睁眼，确认身份，闭眼。",
  bomber_close: "炸弹人请闭眼。",
  blood_seal: "血月使徒自爆，血月当空！今夜神职技能全部失效！",
  bomber_boom: "炸弹被引爆！票选他的玩家全部被炸出局！",
  wolfkingShot: "狼王出局，可以开枪带走一人。",
  prophetReport: "竞选警长结束，请公布首夜情况。",
  speech: "开始发言。",
}

export interface FlowStep {
  night: number
  label: string
  target: string
  detail: string
}

export interface GameState {
  board: string
  boardRoles: string[] | null
  voiceEnabled: boolean
  voices: Record<string, string>
  judge: string
  judgeScores: Record<string, number>
  playersConfirmed: boolean
  players: Player[]
  round: number
  phase: Phase
  flow: FlowStep[]
  witchSaveUsed: boolean
  witchPoisonUsed: boolean
  nightUsedDrug: null | "save" | "poison"
  nightWolfKill: string
  nightGuardTarget: string
  nightWitchPoison: string
  nightWitchSave: string
  nightSameSaveKill: boolean
  nightSteps: Record<string, boolean>
  guardLastTarget: string
  hunterShotPending: boolean
  hunterShotDone: boolean
  wolfKingShotPending: boolean
  wolfKingShotDone: boolean
  prophetReport: string
  skipVote: boolean
  globalLog: string[]
  nightLog: string[]
  recordText: string
  winCamp: WinCamp
  /** 胜负锁定原因（首个达成条件时写入，后续不再覆盖） */
  winReason: string
  /** 获胜的是哪个第三方：WG=人狼恋；bomber=炸弹人；""=非第三方 */
  winningThird: "WG" | "bomber" | ""
  /** 已达成但尚未被 checkWin 消费的胜局（死亡事件顺序锁定用） */
  winPending: { camp: NonNullable<WinCamp>; reason: string; winningThird: "WG" | "bomber" | "" } | null
  jingHui: string
  /** 待处理警长的名字（警长出局且未被移交/流失时由 BadgeService 置入，UI 消费） */
  badgePending: string
  wolfSelfKill: boolean
  knightDuelUsed: boolean
  winMode: "edge" | "city"
  uiDone: Record<string, boolean>
  mvp: string
  svp: string
  beiguo: string
  finished: boolean
  /** 丘比特首夜连的情侣（2 人名字，顺序无关） */
  lovers: string[]
  /** 狼美人当前生效的被魅惑者（被票/枪出局时触发殉情；空串表示未魅惑） */
  charmedName: string
  /** 狼美人上一夜魅惑的对象（用于「不可连续两晚魅惑同一人」） */
  charmLastTarget: string
  /** 最近一次白天被投票放逐出局的玩家名（守墓人读取；""=无人被放逐） */
  lastVoteOut: string
  /** 噩梦之影本夜恐惧目标（""=未恐惧） */
  nightmareFearTarget: string
  /** 本夜狼队被恐惧：狼人刀人环节无法刀人（噩梦之影技能） */
  wolfFearedTonight: boolean
  /** 血月使徒自爆封印：当夜神职技能全部失效（自爆时置入，天亮清除） */
  bloodMoonSeal: boolean
  /** 警上自爆：血月封印顺延到下一夜（首夜警上自爆时置入，下一夜天亮清除） */
  bloodSealNextNight: boolean
  /** 警上自爆：天亮后跳过当天发言/投票，直接进入下一夜 */
  skipDayAfterDawn: boolean
  /** 猎魔人本夜狩猎目标（""=未狩猎；天亮结算） */
  nightHuntTarget: string
  /** 摄梦人本夜摄梦目标（""=未入梦；连续两晚同梦触发梦杀） */
  nightDreamTarget: string
  /** 摄梦人本夜连梦触发梦杀目标（""=无） */
  nightDreamKill: string
  /** 炸弹人爆炸后无人生还（或只剩自己）独赢已达成（胜负直接判第三方） */
  bombVictory: boolean
  /** 炸弹人爆炸后等待遗言结束再判胜负（期间 recordWin/checkWin 挂起） */
  bombLastWordsPending: boolean
  /** 炸弹人放逐目标（遗言队列首位） */
  lastBombBomber: string
  /** 本次爆炸直接炸死的玩家（投票名单中爆炸时仍存活者；UI 按号码升序） */
  lastBombVictims: string[]
  /** 模拟对局模式：不同步飞书 */
  simMode: boolean
  /** 模拟对局变体：normal=普通模拟；gods=诸神之战（默认屠城，角色自定义） */
  simVariant: "normal" | "gods"
  /** 是否已在首页选择了对局模式（唯一首页入口，选择后才可进入） */
  modeChosen: boolean
  /**
   * 本局被持续压制过的阵营（求解器判定为劣势方，且连续出现足够多次）。
   * 结算时胜方命中这里就记一次绝地翻盘。
   */
  underdogs: Camp[]
  /** 绝地翻盘：胜方在本局中确实处于过劣势 */
  comeback: boolean
  /** 最近一次观察到「处于劣势」的阵营 */
  underdogCamp: Camp | null
  /** 该阵营连续劣势的观察次数，达到阈值才计入 underdogs */
  underdogStreak: number
}

export function defaultMark(): Mark {
  return {
    prophetCheckWolf: 0,
    prophetCheckGood: false,
    prophetNoCheckCount: 0,
    witchSaveGood: false,
    witchPoWolf: false,
    witchPoGood: false,
    hunterKillWolf: false,
    hunterKillGood: false,
    hunterIsPoisoned: false,
    wolfKingShotGood: false,
    wolfKingShotWolf: false,
    wolfKingIsPoisoned: false,
    wolfBombTarget: "",
    guardHitCount: 0,
    guardSameSaveKill: false,
    wolfHanTiaoJinghui: false,
    wolfSelfKillCheat: false,
    idiotFlipped: false,
    voteTarget: "",
    voteWolfCount: 0,
    voteGoodCount: 0,
    dreadKnightRevengeUsed: false,
    dreadKnightCheckedTonight: false,
    dreadKnightPoisonedTonight: false,
    dreadKnightRevengeCount: 0,
    dreadKnightEverChecked: false,
    dreadKnightEverPoisoned: false,
    dreadKnightRevengeTarget: "",
    dreadKnightCheckNoRevenge: false,
    dreadKnightPoisonNoRevenge: false,
    gargoyleKilledTonight: false,
    skillDisabled: false,
    hasKnife: false,
    isTransform: false,
    roleModel: "",
    prevDreamTarget: "",
    dreamShield: false,
    bloodDelayedExile: false,
    huntWolfCount: 0,
    huntGoodCount: 0,
    dreamKillWolf: 0,
    dreamKillGood: 0,
    fearWolfCount: 0,
    fearGodCount: 0,
    fearResolved: false,
    bombWolfCount: 0,
    bombGoodCount: 0,
    bloodSealCount: 0,
  }
}

export function defaultState(): GameState {
  return {
    board: DEFAULT_BOARD,
    boardRoles: null,
    voiceEnabled: true,
    voices: { ...DEFAULT_VOICES },
    judge: "",
    judgeScores: {},
    playersConfirmed: false,
    players: [],
    round: 0,
    phase: "idle",
    flow: [],
    witchSaveUsed: false,
    witchPoisonUsed: false,
    nightUsedDrug: null,
    nightWolfKill: "",
    nightGuardTarget: "",
    nightWitchPoison: "",
    nightWitchSave: "",
    nightSameSaveKill: false,
    nightSteps: freshNightSteps(),
    guardLastTarget: "",
    hunterShotPending: false,
    hunterShotDone: false,
    wolfKingShotPending: false,
    wolfKingShotDone: false,
    prophetReport: "",
    skipVote: false,
    globalLog: [],
    nightLog: [],
    recordText: "",
    winCamp: null,
    winReason: "",
    winningThird: "",
    winPending: null,
    jingHui: "",
    badgePending: "",
    wolfSelfKill: false,
    knightDuelUsed: false,
    winMode: "edge",
    uiDone: {},
    mvp: "",
    svp: "",
    beiguo: "",
    finished: false,
    lovers: [],
    charmedName: "",
    charmLastTarget: "",
    lastVoteOut: "",
    nightmareFearTarget: "",
    wolfFearedTonight: false,
    bloodMoonSeal: false,
    bloodSealNextNight: false,
    skipDayAfterDawn: false,
    nightHuntTarget: "",
    nightDreamTarget: "",
    nightDreamKill: "",
    bombVictory: false,
    bombLastWordsPending: false,
    lastBombBomber: "",
    lastBombVictims: [],
    simMode: true,
    simVariant: "normal",
    modeChosen: false,
    underdogs: [],
    comeback: false,
    underdogCamp: null,
    underdogStreak: 0,
  }
}

export function normalizeState(s: GameState): GameState {
  const base = defaultState()
  const st: GameState = Object.assign(base, s)
  st.voices = Object.assign({ ...DEFAULT_VOICES }, s.voices || {})
  if (st.voices.witch && st.voices.witch.includes("{killed}")) {
    st.voices.witch = DEFAULT_VOICES.witch
  }
  // 旧默认语音迁移：只替换仍是旧默认文案的项，保留用户自定义
  const LEGACY_VOICE_DEFAULTS: Record<string, string> = {
    explode: "狼人自爆：直接摆烂摊牌，不演了！白天结束全体闭眼入夜。",
    knight_duel_wolf: "骑士一剑戳中大灰狼！狼人直接寄，火速入夜！",
    knight_duel_good: "骑士看走眼翻车，自己白给，继续盘！",
    wwk_boom: "白狼王掀桌自爆！顺手薅走一个，直接入夜。",
  }
  for (const [id, oldText] of Object.entries(LEGACY_VOICE_DEFAULTS)) {
    if (st.voices[id] === oldText) st.voices[id] = DEFAULT_VOICES[id]
  }
  if (typeof st.knightDuelUsed !== "boolean") st.knightDuelUsed = false
  if (typeof st.wolfKingShotPending !== "boolean") st.wolfKingShotPending = false
  if (typeof st.wolfKingShotDone !== "boolean") st.wolfKingShotDone = false
  if (typeof st.prophetReport !== "string") st.prophetReport = ""
  if (st.winMode !== "city") st.winMode = "edge"
  if (typeof st.badgePending !== "string") st.badgePending = ""
  st.players.forEach((p) => {
    p.mark = Object.assign(defaultMark(), p.mark || {})
    if (p.scoreRound === undefined) p.scoreRound = 0
    if (p.scoreTotal === undefined) p.scoreTotal = 0
    if (p.star === undefined) p.star = "-"
    if (!p.scoreDetail) p.scoreDetail = []
    if (p.deathReason === undefined) p.deathReason = ""
    if (p.no === undefined) p.no = 0
    // 旧数据：guardHit 布尔 → guardHitCount 计数（守中过即算 1 次）
    const legacyGuardHit = (p.mark as unknown as { guardHit?: boolean }).guardHit
    if (legacyGuardHit && !(p.mark.guardHitCount || 0)) p.mark.guardHitCount = 1
    // 旧数据：无 avatar 时随机分配一个默认头像
    if (!p.avatar) p.avatar = randomDefaultAvatar()
  })
  if (!st.judgeScores || typeof st.judgeScores !== "object") st.judgeScores = {}
  if (!st.uiDone || typeof st.uiDone !== "object") st.uiDone = {}
  // v9：角色改为夜晚睁眼确认。已在局中的旧存档视为已确认参与，保留访问权限
  if (st.players.length > 0 && (st.round > 0 || st.phase !== "idle")) st.playersConfirmed = true
  if (!Array.isArray(st.flow)) st.flow = []
  if (!Array.isArray(st.lovers)) st.lovers = []
  if (typeof st.charmedName !== "string") st.charmedName = ""
  if (typeof st.charmLastTarget !== "string") st.charmLastTarget = ""
  if (typeof st.lastVoteOut !== "string") st.lastVoteOut = ""
  if (typeof st.nightmareFearTarget !== "string") st.nightmareFearTarget = ""
  if (typeof st.wolfFearedTonight !== "boolean") st.wolfFearedTonight = false
  if (typeof st.bloodMoonSeal !== "boolean") st.bloodMoonSeal = false
  if (typeof st.bloodSealNextNight !== "boolean") st.bloodSealNextNight = false
  if (typeof st.skipDayAfterDawn !== "boolean") st.skipDayAfterDawn = false
  if (typeof st.nightHuntTarget !== "string") st.nightHuntTarget = ""
  if (typeof st.nightDreamTarget !== "string") st.nightDreamTarget = ""
  if (typeof st.nightDreamKill !== "string") st.nightDreamKill = ""
  if (typeof st.bombVictory !== "boolean") st.bombVictory = false
  if (typeof st.bombLastWordsPending !== "boolean") st.bombLastWordsPending = false
  if (typeof st.lastBombBomber !== "string") st.lastBombBomber = ""
  if (!Array.isArray(st.lastBombVictims)) st.lastBombVictims = []
  if (typeof st.simMode !== "boolean") st.simMode = true
  if (st.simVariant !== "gods" || !st.simMode) st.simVariant = "normal"
  if (typeof st.winReason !== "string") st.winReason = ""
  if (st.winningThird !== "WG" && st.winningThird !== "bomber") st.winningThird = ""
  if (!st.winPending || typeof st.winPending !== "object") st.winPending = null
  if (typeof st.modeChosen !== "boolean") st.modeChosen = false
  if (!Array.isArray(st.underdogs)) st.underdogs = []
  if (typeof st.comeback !== "boolean") st.comeback = false
  if (typeof st.underdogStreak !== "number" || !Number.isFinite(st.underdogStreak)) st.underdogStreak = 0
  if (st.underdogCamp !== "wolf" && st.underdogCamp !== "good") st.underdogCamp = null
  const legacy = (s as { judgeScore?: number }).judgeScore
  if (typeof legacy === "number" && st.judge) {
    st.judgeScores[st.judge] = (st.judgeScores[st.judge] || 0) + legacy
  }
  return st
}

export function newPlayer(name: string): Player {
  return {
    name,
    no: 0,
    alive: true,
    role: "",
    scoreRound: 0,
    scoreTotal: 0,
    star: "-",
    scoreDetail: [],
    mark: defaultMark(),
    deathReason: "",
  }
}

/** 顺序即编号：把所有玩家的座位号重排为列表位置（1 起） */
export function renumberPlayers(state: GameState): void {
  state.players.forEach((p, i) => {
    p.no = i + 1
  })
}

/** 玩家统一显示格式：号码（姓名 角色），如 3.张三(🐺狼人) */
export function playerLabel(p: Player, idx?: number): string {
  const no = p.no || (idx ?? 0) + 1
  const role = p.role ? `(${ROLE_EMOJI[p.role] || ""}${p.role})` : ""
  return `${no}.${p.name}${role}`
}

/** UI 紧凑变体：角色用简写，如 3.张三(🐺狼)；日志/飞书同步仍用 playerLabel 全名 */
export function playerLabelShort(p: Player, idx?: number): string {
  const no = p.no || (idx ?? 0) + 1
  const role = p.role ? `(${ROLE_EMOJI[p.role] || ""}${roleShort(p.role)})` : ""
  return `${no}.${p.name}${role}`
}

/** 当前板子的角色列表：优先使用自定义 boardRoles，否则用默认配置 */
export function getBoardRoles(state: GameState): string[] {
  return state.boardRoles ?? boardConfig[state.board]
}

/** 编辑板子角色组合；返回错误或 null */
export function setBoardRoles(state: GameState, roles: string[]): string | null {
  const list = roles.filter(Boolean)
  if (list.length < 2) return "板子至少需要 2 个角色"
  if (!list.some((r) => isWolfRole(r))) return "板子至少需要 1 个狼人"
  if (!list.some((r) => !isWolfRole(r))) return "板子至少需要 1 个好人"
  for (const r of UNIQUE_ROLES) {
    if (list.filter((x) => x === r).length > 1) return `角色【${r}】最多 1 个，不能重复添加`
  }
  state.boardRoles = list
  return null
}

/** 该角色当前是否还能再添加（唯一性角色已有 1 个后不能再加） */
export function canAddRole(roles: string[], role: string): boolean {
  if (UNIQUE_ROLES.includes(role)) return !roles.includes(role)
  return true
}

// ===================== 语音播报配置 =====================

export function setVoice(state: GameState, id: string, text: string): void {
  state.voices[id] = text
}

export function setVoiceEnabled(state: GameState, enabled: boolean): void {
  state.voiceEnabled = enabled
}

// ===================== 法官 / 参与确认 =====================

export function setJudge(state: GameState, name: string): void {
  state.judge = name
  const idx = state.players.findIndex((p) => p.name === name)
  if (idx >= 0) {
    state.players.splice(idx, 1)
    pushGlobalLog(state, `⚖️${name} 被设为法官，已从参与玩家中移除`)
  }
}

export function confirmPlayers(state: GameState): void {
  state.playersConfirmed = true
  pushGlobalLog(state, `✅法官已确认 ${state.players.length} 名玩家参与`)
}

/** 取某环节播报文案，{killed} 不透露真实名字，统一替换为「某玩家」 */
export function resolveVoice(state: GameState, id: string): string {
  const t = state.voices[id] || ""
  return t.replace(/\{killed\}/g, "某玩家")
}
export function maxNeed(state: GameState): number {
  return getBoardRoles(state).length
}

/** 当前板子每种角色的配额 */
export function roleQuota(state: GameState): Record<string, number> {
  const q: Record<string, number> = {}
  getBoardRoles(state).forEach((r) => {
    q[r] = (q[r] || 0) + 1
  })
  return q
}

/** 分配角色：校验该角色配额是否已满，返回错误或 null */
export function setRole(state: GameState, idx: number, role: string): string | null {
  const p = state.players[idx]
  if (!p) return "玩家不存在"
  if (!role) {
    p.role = ""
    return null
  }
  const quota = roleQuota(state)
  const quotaN = quota[role] || 0
  if (quotaN === 0) {
    return `本板子没有【${role}】角色`
  }
  const alreadySelf = p.role === role
  const used = state.players.filter((x) => x.role === role).length - (alreadySelf ? 1 : 0)
  if (used >= quotaN) {
    return `角色【${role}】已满（本板子 ${quotaN} 个）`
  }
  p.role = role
  return null
}

/** 所有非平民角色确认完时，把剩余未分配玩家自动填为平民；返回新填充人数 */
export function autoFillCivilians(state: GameState): number {
  const quota = roleQuota(state)
  // 使用角色系统判断平民角色
  const civilRoleId = Object.keys(quota).find((r) => {
    const role = getRoleInstance(r)
    return role && role.def.camp === "villager"
  }) || "平民"
  const nonCivil = Object.keys(quota).filter((r) => r !== civilRoleId)
  const allDone = nonCivil.every((r) => state.players.filter((p) => p.role === r).length === quota[r])
  if (!allDone) return 0
  const civilQuota = quota[civilRoleId] || 0
  const civilNow = state.players.filter((p) => p.role === civilRoleId).length
  if (civilNow >= civilQuota) return 0
  let added = 0
  for (const p of state.players) {
    if (civilNow + added >= civilQuota) break
    if (p.role) continue
    p.role = civilRoleId
    added++
  }
  if (added > 0) resolvePendingNightmareFear(state)
  return added
}

/** 法官在夜晚睁眼时确认某角色持有者；确认完所有神职后自动把剩余玩家填为平民 */
export function confirmRole(state: GameState, name: string, role: string): string | null {
  const p = state.players.find((x) => x.name === name)
  if (!p) return "玩家不存在"
  if (p.role) return `${name} 已确认过身份（${p.role}），不能重复确认`
  const quota = roleQuota(state)
  const quotaN = quota[role] || 0
  if (quotaN === 0) return `本板子没有【${role}】角色`
  const used = state.players.filter((x) => x.role === role).length
  if (used >= quotaN) return `角色【${role}】已满（本板子 ${quotaN} 个）`
  p.role = role
  autoFillCivilians(state)
  resolvePendingNightmareFear(state)
  return null
}

/** 批量确认狼人（狼人睁眼时由法官一次确认同一种狼阵营角色，默认「狼人」） */
export function confirmWolves(state: GameState, names: string[], roleId = "狼人"): string | null {
  const quota = roleQuota(state)
  const need = quota[roleId] || 0
  if (need === 0) return `本板子没有【${roleId}】角色`
  const now = state.players.filter((p) => p.role === roleId).length
  const unassigned = [...new Set(names)].filter(
    (n) => n && !state.players.find((p) => p.name === n)?.role,
  )
  if (now + unassigned.length > need) {
    return `${roleId}已确认 ${now} 个，本板子需要 ${need} 个，最多还能确认 ${need - now} 个`
  }
  for (const n of unassigned) {
    const err = confirmRole(state, n, roleId)
    if (err) return err
  }
  return null
}

/** 开局重置：清角色与所有对局状态（角色在首夜睁眼时由法官确认） */
export function startNewGame(state: GameState): void {
  state.players.forEach((p) => {
    p.role = ""
    p.alive = true
    p.scoreRound = 0
    p.scoreDetail = []
    p.mark = defaultMark()
  })
  state.round = 0
  state.phase = "idle"
  state.uiDone = {}
  state.flow = []
  state.witchSaveUsed = false
  state.witchPoisonUsed = false
  state.nightUsedDrug = null
  state.nightWolfKill = ""
  state.nightGuardTarget = ""
  state.nightWitchPoison = ""
  state.nightWitchSave = ""
  state.nightSameSaveKill = false
  state.nightSteps = freshNightSteps()
  state.guardLastTarget = ""
  state.hunterShotPending = false
  state.hunterShotDone = false
  state.wolfKingShotPending = false
  state.wolfKingShotDone = false
  state.prophetReport = ""
  state.skipVote = false
  state.bloodSealNextNight = false
  state.skipDayAfterDawn = false
  state.winCamp = null
  state.winReason = ""
  state.winningThird = ""
  state.winPending = null
  state.jingHui = ""
  state.wolfSelfKill = false
  state.knightDuelUsed = false
  state.mvp = ""
  state.svp = ""
  state.beiguo = ""
  state.finished = false
  state.lovers = []
  state.lastVoteOut = ""
  state.nightmareFearTarget = ""
  state.wolfFearedTonight = false
  state.bloodMoonSeal = false
  state.nightHuntTarget = ""
  state.nightDreamTarget = ""
  state.bombVictory = false
  state.bombLastWordsPending = false
  state.lastBombBomber = ""
  state.lastBombVictims = []
  state.underdogs = []
  state.comeback = false
  state.underdogCamp = null
  state.underdogStreak = 0
  refreshHiddenWolfKnife(state)
  pushGlobalLog(state, "✅本局开始：发牌后由法官在夜晚睁眼时确认身份")
}

export function aliveNames(state: GameState): string[] {
  return state.players.filter((p) => p.alive).map((p) => p.name)
}

/** 去掉旧日志的 [时间] 前缀（历史数据兼容显示用） */
export function cleanLogLine(line: string): string {
  return line.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, "")
}

/** 把日志文本里的玩家名替换为 号码(身份) 展示，避免重复包装 */
export function decorateLog(state: GameState, line: string): string {
  let s = line
  for (const p of [...state.players].sort((a, b) => b.name.length - a.name.length)) {
    if (!p.role) continue
    const re = new RegExp(`(?<![\\d.])${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\()`, "g")
    s = s.replace(re, playerLabel(p))
  }
  return s
}

export function pushGlobalLog(state: GameState, txt: string): void {
  state.globalLog.push(txt)
}
export function pushNightLog(state: GameState, txt: string): void {
  state.nightLog.push(txt)
}

/** 记录对局流程步骤（进度流用） */
export function pushFlow(state: GameState, label: string, target = "", detail = ""): void {
  state.flow.push({ night: state.round, label, target, detail })
}

// ===================== 丘比特 / 情侣 =====================

/** 判断某玩家是否为情侣成员 */
export function isLover(state: GameState, name: string): boolean {
  return state.lovers.includes(name)
}

/** 情侣中的另一位；非情侣或配偶不存在返回空串 */
export function loverPartner(state: GameState, name: string): string {
  if (!isLover(state, name)) return ""
  return state.lovers.find((n) => n !== name) || ""
}

/** 链型：GG 人人恋 / WW 狼狼恋 / WG 人狼恋；身份未全部确认时返回空串（黑化野孩子按狼计） */
export function getChainType(state: GameState): "GG" | "WW" | "WG" | "" {
  const [a, b] = state.lovers
  if (!a || !b) return ""
  const pa = state.players.find((p) => p.name === a)
  const pb = state.players.find((p) => p.name === b)
  if (!pa || !pb || !pa.role || !pb.role) return ""
  const aw = isEffectiveWolf(pa)
  const bw = isEffectiveWolf(pb)
  if (aw && bw) return "WW"
  if (!aw && !bw) return "GG"
  return "WG"
}

/** 丘比特首夜连人：连接两名玩家为情侣（顺序无关；可连自己，自己也是链中一环） */
export function cupidConnect(state: GameState, names: string[]): string | null {
  // 使用角色系统查找丘比特角色
  const cupidRole = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "丘比特"
  })
  if (!cupidRole) return "本局没有丘比特"
  const list = [...new Set(names.filter(Boolean))]
  if (list.length !== 2) return "请选择两位玩家作为情侣"
  for (const n of list) {
    if (!state.players.some((p) => p.name === n)) return `未找到玩家 ${n}`
  }
  if (state.lovers.length) return "情侣已在首夜连过，不能重复连接"
  state.lovers = list
  const chain = getChainType(state)
  const chainText = chain === "WG" ? "人狼恋" : chain === "WW" ? "狼狼恋" : chain === "GG" ? "人人恋" : "待身份确认后判定"
  const third = chain === "WG" ? "（第三方阵营成立！）" : ""
  pushGlobalLog(state, `💘丘比特将 ${list.join(" ❤ ") || ""} 连为情侣：${chainText}${third}`)
  pushNightLog(state, `💘丘比特连人：${list.join(" ❤ ")}（${chainText}）`)
  pushFlow(state, "丘比特连人", list.join("、"), chainText)
  return null
}

/** 情侣一人出局 → 另一人立刻殉情（不开枪，连带死亡）；返回本次殉情出局的名字 */
export function applyLoverDeaths(state: GameState): string[] {
  const killed: string[] = []
  for (const name of state.lovers) {
    const p = state.players.find((x) => x.name === name)
    if (!p || p.alive) continue
    const partnerName = loverPartner(state, name)
    if (!partnerName) continue
    const partner = state.players.find((x) => x.name === partnerName)
    if (partner && partner.alive) {
      partner.alive = false
      partner.deathReason = "lover"
      recordWinEvent(state)
      killed.push(partnerName)
      // 殉情不递归走 killPlayer，警徽 pending 必须在此补置，否则 GamePanel 的移交弹窗永不触发、警徽卡在死人身上
      if (state.jingHui === partnerName) state.badgePending = partnerName
    }
  }
  // 合并殉情播报：所有殉情玩家合并为一条日志
  if (killed.length > 0) {
    const labels = killed.map((n) => {
      const p = state.players.find((x) => x.name === n)
      return p ? `${p.no}号${p.name}` : n
    }).join("、")
    pushGlobalLog(state, `💔${labels}因情侣殉情出局`)
    pushNightLog(state, `💔${labels}殉情出局`)
  }
  return killed
}

/**
 * 殉情死亡：直接置死、不触发角色技能钩子（猎人/狼王不开枪、白痴不翻牌）。
 * 供情侣殉情与狼美人魅惑殉情共用；返回本次新增出局的名字（含被连带的伴侣）。
 */
export function killAsLover(state: GameState, name: string): string[] {
  const p = state.players.find((x) => x.name === name)
  if (!p || !p.alive) return []
  p.alive = false
  p.deathReason = "lover"
  if (state.jingHui === name) state.badgePending = name
  const killed = [name]
  killed.push(...applyLoverDeaths(state))
  return killed
}

/** 全局死亡前钩子（供角色系统扩展，如白痴翻牌免死） */
const beforeDeathHooks: Array<(state: GameState, evt: { name: string; reason: DieReason }) => boolean> = []

/** 注册死亡前钩子（返回 true 则拦截死亡） */
export function onBeforeDeath(hook: (state: GameState, evt: { name: string; reason: DieReason }) => boolean): () => void {
  beforeDeathHooks.push(hook)
  return () => {
    const idx = beforeDeathHooks.indexOf(hook)
    if (idx >= 0) beforeDeathHooks.splice(idx, 1)
  }
}

/** 全局死亡后钩子 */
const afterDeathHooks: Array<(state: GameState, evt: { name: string; reason: DieReason; killed: string[] }) => void> = []

/** 注册死亡后钩子 */
export function onAfterDeath(hook: (state: GameState, evt: { name: string; reason: DieReason; killed: string[] }) => void): () => void {
  afterDeathHooks.push(hook)
  return () => {
    const idx = afterDeathHooks.indexOf(hook)
    if (idx >= 0) afterDeathHooks.splice(idx, 1)
  }
}

/**
 * 唯一死亡入口：玩家出局统一走这里。
 * 职责：翻转存活 + 记录死因 + 殉情级联（+ 后续版本的角色死亡钩子/警徽处理在此派发）。
 * 返回本次实际新增出局的名字（含殉情对手），供调用方汇总播报/计数。
 * 注意：拿枪类标记（猎人/狼王能否开枪）取决于是否被毒，属于调用点上下文，仍由各调用点设置，
 * 不在本入口处理，以免破坏被毒吞枪语义。
 */
export function killPlayer(state: GameState, name: string, reason: DieReason, source?: string): string[] {
  const p = state.players.find((x) => x.name === name)
  if (!p || !p.alive) return []

  // 触发死亡前钩子（角色可拦截死亡，如白痴翻牌）
  const evt = { name, reason, source }
  for (const hook of beforeDeathHooks) {
    if (hook(state, evt)) {
      // 被拦截：不执行死亡
      return []
    }
  }

  p.alive = false
  p.deathReason = reason
  // 死亡事件级判胜：先达成条件者锁定，后续死亡/开枪不能改判
  recordWinEvent(state)
  const killed = [name]
  killed.push(...applyLoverDeaths(state))
  // 警长出局 → 置待处理标记，由 BadgeService/UI 决策移交或流失
  // （自爆自吞警徽在 wolfBaoZha/wolfKingBaoZha 里由 loseBadge 直接处理，不走 pending）
  if (reason !== "selfBomb" && state.jingHui === name) {
    state.badgePending = name
  }

  // 触发死亡后钩子
  const afterEvt = { name, reason, killed }
  for (const hook of afterDeathHooks) {
    try {
      hook(state, afterEvt)
    } catch (e) {
      console.error(`[killPlayer] afterDeath hook error:`, e)
    }
  }

  // 减员可能影响隐狼刀人权（除隐狼外狼全灭 → 隐狼接刀）
  refreshHiddenWolfKnife(state)

  return killed
}


// ===================== 操作函数（纯逻辑，返回错误信息或 null）=====================

export function applyBoard(state: GameState, board: string): void {
  state.board = board
  state.boardRoles = null
}

export function addPlayer(state: GameState, nick: string, no?: number): string | null {
  const name = nick.trim()
  if (!name) return "请输入玩家昵称"
  if (state.judge === name) return "该成员已被选为法官，不能作为玩家参与（法官与玩家互斥）"
  if (state.players.length >= maxNeed(state)) return `当前板子最多${maxNeed(state)}人，无法新增玩家`
  if (state.players.find((p) => p.name === name)) return "该玩家已签到"
  let n: number
  if (no === undefined || no === null) {
    n = state.players.reduce((m, p) => Math.max(m, p.no || 0), 0) + 1
  } else {
    n = Math.floor(no)
    if (n < 1) return "编号需 ≥ 1"
    if (state.players.some((p) => p.no === n)) return `编号 ${n} 已被占用`
  }
  const p = newPlayer(name)
  p.no = n
  p.avatar = randomDefaultAvatar()
  state.players.push(p)
  return null
}

export function delPlayer(state: GameState, idx: number): void {
  state.players.splice(idx, 1)
}

/** 拖动排序：把 from 位置的玩家移动到 to 位置 */
export function movePlayer(state: GameState, from: number, to: number): void {
  if (from < 0 || to < 0 || from >= state.players.length || to >= state.players.length || from === to) return
  const [item] = state.players.splice(from, 1)
  state.players.splice(to, 0, item)
}

/** 拖动结束后按新顺序整序（跨列拖动用）：names 为新顺序的玩家名 */
export function reorderPlayers(state: GameState, names: string[]): void {
  const byName = new Map(state.players.map((p) => [p.name, p]))
  const next: Player[] = []
  for (const n of names) {
    const p = byName.get(n)
    if (p) {
      next.push(p)
      byName.delete(n)
    }
  }
  for (const p of byName.values()) next.push(p)
  state.players = next
  renumberPlayers(state)
}

export function clearAllPlayers(state: GameState): void {
  state.players = []
}

export function resetWholeGame(state: GameState): GameState {
  const board = state.board
  const boardRoles = state.boardRoles ? [...state.boardRoles] : null
  const judge = state.judge
  const judgeScores = state.judgeScores
  const winMode = state.winMode
  const simMode = state.simMode
  const simVariant = state.simVariant
  const modeChosen = state.modeChosen
  const s = defaultState()
  s.board = board
  s.boardRoles = boardRoles
  s.judge = judge
  s.judgeScores = judgeScores
  s.winMode = winMode
  s.simMode = simMode
  s.simVariant = simVariant
  s.modeChosen = modeChosen
  return s
}

/** 当前法官累计分 */
export function judgeTotal(state: GameState): number {
  return state.judge ? state.judgeScores[state.judge] || 0 : 0
}

export function manualSaveRoles(state: GameState): string | null {
  for (const p of state.players) {
    if (!p.role || p.role === "") return "存在玩家尚未分配角色，请给全部玩家选好角色后再保存"
  }
  const quota = roleQuota(state)
  const counts: Record<string, number> = {}
  state.players.forEach((p) => {
    counts[p.role] = (counts[p.role] || 0) + 1
  })
  for (const [role, need] of Object.entries(quota)) {
    if ((counts[role] || 0) !== need) {
      return `角色【${role}】应 ${need} 个，实际 ${counts[role] || 0} 个，请检查后重新分配`
    }
  }
  for (const [role, n] of Object.entries(counts)) {
    if (!(role in quota)) return `本板子没有【${role}】角色，请重新分配`
  }
  state.players.forEach((p) => {
    p.alive = true
    p.scoreRound = 0
    p.scoreDetail = []
    p.mark = defaultMark()
  })
  state.round = 0
  state.phase = "idle"
  state.uiDone = {}
  state.flow = []
  state.witchSaveUsed = false
  state.witchPoisonUsed = false
  state.nightUsedDrug = null
  state.nightWolfKill = ""
  state.nightGuardTarget = ""
  state.nightWitchPoison = ""
  state.nightWitchSave = ""
  state.nightSameSaveKill = false
  state.nightSteps = freshNightSteps()
  state.guardLastTarget = ""
  state.hunterShotPending = false
  state.hunterShotDone = false
  state.wolfKingShotPending = false
  state.wolfKingShotDone = false
  state.prophetReport = ""
  state.skipVote = false
  state.bloodSealNextNight = false
  state.skipDayAfterDawn = false
  state.winCamp = null
  state.winReason = ""
  state.winningThird = ""
  state.winPending = null
  state.jingHui = ""
  state.wolfSelfKill = false
  state.knightDuelUsed = false
  state.mvp = ""
  state.svp = ""
  state.beiguo = ""
  state.finished = false
  state.lovers = []
  state.lastVoteOut = ""
  state.nightmareFearTarget = ""
  state.wolfFearedTonight = false
  state.bloodMoonSeal = false
  state.nightHuntTarget = ""
  state.nightDreamTarget = ""
  state.bombVictory = false
  state.bombLastWordsPending = false
  state.lastBombBomber = ""
  state.lastBombVictims = []
  refreshHiddenWolfKnife(state)
  pushGlobalLog(state, "✅法官手动分配角色完成，本局开始")
  return null
}

export function nextNight(state: GameState): void {
  state.round += 1
  state.phase = "night"
  state.uiDone = {}
  state.nightUsedDrug = null
  state.nightWolfKill = ""
  state.nightGuardTarget = ""
  state.nightWitchPoison = ""
  state.nightWitchSave = ""
  state.nightSameSaveKill = false
  // 狼美人：上一夜生效的魅惑对象落为「禁连选」基准，之后可重新魅惑
  if (state.charmedName) state.charmLastTarget = state.charmedName
  state.nightSteps = freshNightSteps()
  // 每夜重置：恐惧/狩猎/入梦意图；神职封印由天亮清除（血月自爆封印持续到当夜结束）
  state.nightmareFearTarget = ""
  state.wolfFearedTonight = false
  state.nightHuntTarget = ""
  state.nightDreamTarget = ""
  state.nightDreamKill = ""
  // 重置每夜标记
  for (const p of state.players) {
    p.mark.dreadKnightCheckedTonight = false
    p.mark.dreadKnightPoisonedTonight = false
    p.mark.gargoyleKilledTonight = false
    p.mark.skillDisabled = false
    p.mark.dreamShield = false
    p.mark.fearResolved = false
  }
  // 野孩子黑化：榜样已死且自己存活 → 本夜变身；并刷新隐狼刀人权
  checkWildChildTransform(state)
  refreshHiddenWolfKnife(state)
  state.hunterShotPending = false
  state.wolfKingShotPending = false
  state.prophetReport = ""
  state.skipVote = false
  pushGlobalLog(state, `🌙第${state.round}晚，夜晚降临`)
  pushNightLog(state, `🌙第${state.round}晚开始`)
}

export function wolfKill(state: GameState, sel: string): string | null {
  if (state.wolfFearedTonight) return "今夜狼队被噩梦之影恐惧，无法刀人（请确认空刀）"
  // 狼群外特殊狼（石像鬼、隐狼）被恐惧时只封其个人刀人技能：此时场上仅存该特殊狼带刀，需拦刀
  const hiddenWolf = state.players.find((p) => p.alive && p.role === "隐狼")
  if (hiddenWolf?.mark.skillDisabled && hiddenWolfCanKnife(state)) {
    return "隐狼本夜技能被封印，无法刀人（请确认空刀）"
  }
  if (!sel) return "请选择被刀对象"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为刀人对象`
  // 狼美人禁止被刀（防止自刀触发殉情）
  if (getRoleInstance(target.role)?.def.id === "狼美人") return `${sel}是狼美人，禁止被刀`
  // 恶灵骑士禁止被刀（不能自刀）
  if (getRoleInstance(target.role)?.def.id === "恶灵骑士") return `${sel}是恶灵骑士，禁止被刀`
  // 石像鬼不与狼群见面：狼误刀他不算自刀（不标"自刀"提示，女巫救他也不给狼队"骗解药"分）
  // 人狼恋（WG）的狼恋人属第三方，狼队可以刀他；这不算自刀，也不给"自刀骗解药"分。
  // 黑化野孩子按狼计：不在 WG 第三方时，狼刀他仍算自刀。
  const isSelf =
    isEffectiveWolf(target) &&
    getRoleInstance(target.role)?.def.id !== "石像鬼" &&
    !isThirdMember(state, target)
  // 情侣不能互刀：仅狼狼恋（WW）双狼情侣互刀被禁止；
  // 人狼恋（WG）的狼恋人属第三方，按口径可被狼队刀。
  if (isLover(state, sel) && getChainType(state) === "WW") {
    return `情侣不能互刀，请重新选择刀人对象（${sel}是狼人恋人）`
  }
  const prev = state.nightWolfKill
  state.nightSteps.wolf = true
  state.wolfSelfKill = isSelf
  if (prev === sel) {
    // 已是当前刀人目标，重复点击不重复记录
    return null
  }
  state.nightWolfKill = sel
  if (prev) {
    pushNightLog(state, `🌑刀人目标切换：${prev} → ${sel}${isSelf ? "【自刀】" : ""}`)
    pushGlobalLog(state, `🌑狼人刀人目标切换：${prev} → ${sel}${isSelf ? "（自刀）" : ""}`)
  } else {
    pushNightLog(state, `狼人刀：${sel}${isSelf ? "【自刀】" : ""}`)
    pushGlobalLog(state, `🌑狼人刀人：${sel}${isSelf ? "（自刀）" : ""}`)
  }
  pushFlow(state, "狼人刀人", sel, isSelf ? "自刀" : "")
  return null
}

/**
 * 空刀（狼人本夜不刀人）。
 * nightWolfKill 留空即代表无人被刀，下游（夜间结算/解药/自刀加分）本来就按「无刀口」处理，
 * 这里只负责显式记录一次决定，并把狼人睁眼步骤标记为已完成，流程才能继续往下走。
 */
export function wolfEmptyKill(state: GameState): string | null {
  const prev = state.nightWolfKill
  if (prev) {
    // 已经选过刀人：改判为空刀，要把自刀标记撤掉，否则会留下错误的自刀加分
    state.wolfSelfKill = false
    pushNightLog(state, `🌑刀人目标切换：${prev} → 空刀（不刀人）`)
    pushGlobalLog(state, `🌑狼人本夜空刀（不刀人），原目标 ${prev} 作废`)
  } else {
    pushNightLog(state, "狼人空刀：本夜不刀人")
    pushGlobalLog(state, "🌑狼人空刀：本夜不刀人")
  }
  state.nightWolfKill = ""
  state.wolfSelfKill = false
  state.nightSteps.wolf = true
  pushFlow(state, "狼人刀人", "", "空刀")
  return null
}

/** 狼美人夜间魅惑：选择一人，被票/枪出局时其殉情 */
export function charmDo(state: GameState, sel: string): string | null {
  const beauty = state.players.find((p) => getRoleInstance(p.role)?.def.id === "狼美人")
  if (!beauty) return "本局没有狼美人"
  if (!beauty.alive) return "狼美人已出局，本晚不能魅惑"
  if (!sel) return "请选择魅惑对象"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为魅惑对象`
  if (target.name === beauty.name) return "狼美人不能魅惑自己"
  if (sel === state.charmLastTarget) return `不可连续两晚魅惑同一人（${sel}）`
  state.charmedName = sel
  state.nightSteps.charm = true
  pushNightLog(state, `🌹狼美人魅惑：${sel}`)
  pushGlobalLog(state, `🌹狼美人魅惑了 ${sel}`)
  pushFlow(state, "狼美人魅惑", sel)
  return null
}

/** 噩梦之影恐惧：恐狼→当晚狼队空刀；恐神职→目标当晚技能失效；恐自己/民→无效果 */
function applyNightmareFearEffect(state: GameState, nm: Player, target: Player): void {
  if (nm.mark.fearResolved) return
  nm.mark.fearResolved = true
  const sel = target.name
  if (target.name === nm.name) {
    pushNightLog(state, `😱噩梦之影恐惧自己：无效果`)
    pushGlobalLog(state, `😱噩梦之影恐吓了自己（无效果）`)
    pushFlow(state, "噩梦之影恐惧", sel, "无效果")
    return
  }
  if (isEffectiveWolf(target) && getRoleInstance(target.role)?.def.wolfPack === false) {
    // 狼群外特殊狼（石像鬼、隐狼）：验人/刀人是个人的主动技能，恐惧只封其本人技能，不波及狼队
    target.mark.skillDisabled = true
    nm.mark.fearWolfCount = (nm.mark.fearWolfCount || 0) + 1
    pushNightLog(state, `😱噩梦之影恐惧${sel}（特殊狼）：其个人技能本夜失效`)
    pushGlobalLog(state, `😱噩梦之影恐吓了 ${sel}，其本夜技能失效`)
    pushFlow(state, "噩梦之影恐惧", sel, "封特殊狼个人技能")
  } else if (isEffectiveWolf(target)) {
    state.wolfFearedTonight = true
    nm.mark.fearWolfCount = (nm.mark.fearWolfCount || 0) + 1
    pushNightLog(state, `😱噩梦之影恐惧${sel}（狼阵营）：狼队今晚无法刀人`)
    pushGlobalLog(state, `😱噩梦之影恐吓狼队成功：今夜狼人无法刀人`)
    pushFlow(state, "噩梦之影恐惧", sel, "狼队空刀")
  } else if (getRole(target.role)?.camp === "god") {
    target.mark.skillDisabled = true
    // 计分只计预/巫/猎魔/摄梦四类核心神职，防刷守卫/守墓人
    if (["预言家", "女巫", "猎魔人", "摄梦人"].includes(target.role)) {
      nm.mark.fearGodCount = (nm.mark.fearGodCount || 0) + 1
    }
    pushNightLog(state, `😱噩梦之影恐惧${sel}（神职）：目标本夜技能失效`)
    pushGlobalLog(state, `😱噩梦之影恐吓了 ${sel}，其本夜技能失效`)
    pushFlow(state, "噩梦之影恐惧", sel, "封神职")
  } else {
    pushNightLog(state, `😱噩梦之影恐惧${sel}：无效果`)
    pushGlobalLog(state, `😱噩梦之影恐吓了 ${sel}（无效果）`)
    pushFlow(state, "噩梦之影恐惧", sel, "无效果")
  }
}

export function nightmareFear(state: GameState, sel: string): string | null {
  const nm = state.players.find((p) => getRoleInstance(p.role)?.def.id === "噩梦之影")
  if (!nm) return "本局没有噩梦之影"
  if (!nm.alive) return "噩梦之影已出局，本晚不能恐惧"
  if (!sel) return "请选择恐惧对象"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为恐惧对象`
  state.nightmareFearTarget = sel
  state.nightSteps.nightmare = true
  // 首夜目标身份可能尚未确认：先挂起，等 confirmRole/autoFill 确认后再结算效果
  if (!target.role) {
    pushNightLog(state, `😱噩梦之影恐惧${sel}：目标身份未确认，确认后生效`)
    pushGlobalLog(state, `😱噩梦之影恐吓了 ${sel}（身份未确认，待确认后生效）`)
    pushFlow(state, "噩梦之影恐惧", sel, "待身份确认")
    return null
  }
  applyNightmareFearEffect(state, nm, target)
  return null
}

/** 首夜恐惧目标身份确认后补算效果；已解析过则跳过 */
export function resolvePendingNightmareFear(state: GameState): void {
  const nm = state.players.find((p) => getRoleInstance(p.role)?.def.id === "噩梦之影")
  if (!nm || nm.mark.fearResolved) return
  const target = state.players.find((p) => p.name === state.nightmareFearTarget)
  if (!target || !target.role) return
  applyNightmareFearEffect(state, nm, target)
}

/** 野孩子首夜选定榜样 */
export function wildChildPick(state: GameState, sel: string): string | null {
  const wc = state.players.find((p) => getRoleInstance(p.role)?.def.id === "野孩子")
  if (!wc) return "本局没有野孩子"
  if (!wc.alive) return "野孩子已出局"
  if (!sel) return "请选择榜样"
  if (wc.mark.roleModel) return `野孩子已选定榜样（${wc.mark.roleModel}），不能重复选择`
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为榜样`
  if (target.name === wc.name) return "野孩子不能选自己为榜样"
  wc.mark.roleModel = sel
  state.nightSteps.wildChild = true
  pushNightLog(state, `🌱野孩子选定榜样：${sel}`)
  pushGlobalLog(state, `🌱野孩子默默记住了榜样 ${sel}（榜样不会知情）`)
  pushFlow(state, "野孩子选榜样", sel)
  return null
}

/** 野孩子黑化变身检查（入夜时调用）：榜样已死且自己存活且未变身 */
export function checkWildChildTransform(state: GameState): void {
  for (const p of state.players) {
    if (p.role !== "野孩子" || !p.alive || p.mark.isTransform || !p.mark.roleModel) continue
    const model = state.players.find((x) => x.name === p.mark.roleModel)
    if (model && !model.alive) {
      const before = getChainType(state)
      p.mark.isTransform = true
      const after = getChainType(state)
      pushGlobalLog(state, `🐺野孩子${p.name}目睹榜样死亡，黑化为狼人阵营！`)
      pushNightLog(state, `🐺野孩子${p.name}黑化变身`)
      pushFlow(state, "野孩子变身", p.name, "黑化为狼")
      // 野孩子是情侣时，黑化会改变链型：GG→WG 第三方成立；WG→WW 第三方解散。
      // 在变身当刻播报，避免界面只显示「黑化」却看不出阵营关系已变。
      if (before !== after && after === "WG") {
        pushGlobalLog(state, "💘链型变为 人狼恋（WG）：第三方阵营成立！")
        pushNightLog(state, "💘链型变为 人狼恋（WG）：第三方成立")
        pushFlow(state, "链型变化", "人狼恋（WG）", "第三方成立")
      } else if (before !== after && after === "WW") {
        pushGlobalLog(state, "💔链型变为 狼狼恋（WW）：第三方解散，丘比特变回神")
        pushNightLog(state, "💔链型变为 狼狼恋（WW）：第三方解散")
        pushFlow(state, "链型变化", "狼狼恋（WW）", "第三方解散")
      }
    }
  }
}

/** 猎魔人狩猎：选择目标，天亮结算（目标是狼→其死；是好人→猎魔人反噬） */
export function hunterHunt(state: GameState, sel: string): string | null {
  const hm = state.players.find((p) => getRoleInstance(p.role)?.def.id === "猎魔人")
  if (!hm) return "本局没有猎魔人"
  if (!hm.alive) return "猎魔人已出局，本晚不能狩猎"
  if (hm.mark.skillDisabled) return "猎魔人被恐惧，本夜无法行动"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  if (state.round <= 1) return "首夜猎魔人只认人，不狩猎"
  if (!sel) return "请选择狩猎对象"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (target.name === hm.name) return "猎魔人不能狩猎自己"
  if (!target.alive) return `${sel}已出局，不能作为狩猎对象`
  state.nightHuntTarget = sel
  state.nightSteps.hunterWolf = true
  pushNightLog(state, `🗡️猎魔人狩猎：${sel}（天亮结算）`)
  pushGlobalLog(state, `🗡️猎魔人悄悄锁定了狩猎目标：${sel}`)
  pushFlow(state, "猎魔人狩猎", sel)
  return null
}

/** 摄梦人入梦：选择目标成为梦游者（免疫夜间伤害）；连续两晚同一目标触发梦杀 */
export function dreamDo(state: GameState, sel: string): string | null {
  const dm = state.players.find((p) => getRoleInstance(p.role)?.def.id === "摄梦人")
  if (!dm) return "本局没有摄梦人"
  if (!dm.alive) return "摄梦人已出局，本晚不能入梦"
  if (dm.mark.skillDisabled) return "摄梦人被恐惧，本夜无法行动"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  if (!sel) return "请选择入梦对象"
  if (sel === dm.name) return "摄梦人不能对自己入梦"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为入梦对象`
  // 同一夜改选目标时，先清空旧的梦游免疫，避免多人同时带盾
  for (const p of state.players) p.mark.dreamShield = false
  const linked = !!dm.mark.prevDreamTarget && dm.mark.prevDreamTarget === sel
  if (linked) {
    state.nightDreamKill = sel
    state.nightDreamTarget = sel
    state.nightSteps.dreamer = true
    pushNightLog(state, `💭摄梦人连续两晚梦${sel}，触发梦杀`)
    pushGlobalLog(state, `💭摄梦人连续两晚入梦：${sel}，梦杀即将生效`)
    pushFlow(state, "摄梦人入梦", sel, "连梦梦杀")
    return null
  }
  state.nightDreamTarget = sel
  state.nightDreamKill = ""
  state.nightSteps.dreamer = true
  target.mark.dreamShield = true
  pushNightLog(state, `💭摄梦人进入 ${sel} 的梦境（梦游者免疫夜间伤害）`)
  pushGlobalLog(state, `💭摄梦人今晚入梦：${sel}（梦游者免疫夜间伤害）`)
  pushFlow(state, "摄梦人入梦", sel)
  return null
}

/** 炸弹人投票者候选：存活且不是炸弹人自己（已出局不能投票） */
export function bombVoterCandidates(state: GameState, bomberName: string): Player[] {
  return state.players.filter((p) => p.alive && p.name !== bomberName)
}

/** 炸弹人放逐票选名单校验（放逐前调用，防止放逐已生效却校验失败） */
function validateBombVoters(state: GameState, outName: string, voters: string[]): string | null {
  const voterSet = [...new Set(voters.filter(Boolean))]
  if (voterSet.length === 0) return "请勾选投炸弹人的玩家（可多选）"
  for (const v of voterSet) {
    if (v === outName) return "炸弹人不能票自己"
    const vp = state.players.find((x) => x.name === v)
    if (!vp) return `未找到投票玩家 ${v}`
    if (!vp.alive) return `${v}已出局，不能计入票选`
  }
  return null
}

/** 炸弹人被放逐引爆炸弹：炸死被票选者（不开枪）；胜负在遗言结束后按 alive==0 判定 */
function bombExileDetonate(state: GameState, outP: Player, voters: string[], allVoted: boolean): void {
  const voterSet = [...new Set(voters.filter(Boolean))]
  pushGlobalLog(state, `💣炸弹人${outP.name}被放逐，引爆炸弹！炸死：${voterSet.join("、")}`)
  pushFlow(state, "炸弹引爆", voterSet.join("、"))
  if (allVoted) {
    pushGlobalLog(state, `💣全票放逐！炸弹人${outP.name}达成引爆条件！`)
    pushFlow(state, "炸弹人全票", outP.name, "全票放逐")
  }
  state.lastBombVictims = []
  for (const v of voterSet) {
    const vp = state.players.find((x) => x.name === v)
    // 炸弹人自身/已因殉情等先出局者不算爆炸死亡
    if (!vp || !vp.alive) continue
    // 其他第三方阵营与炸弹人得分互斥：不计狼/好
    if (!isThirdMember(state, vp)) {
      if (isEffectiveWolf(vp)) outP.mark.bombWolfCount = (outP.mark.bombWolfCount || 0) + 1
      else outP.mark.bombGoodCount = (outP.mark.bombGoodCount || 0) + 1
    }
    state.lastBombVictims.push(v)
    killPlayer(state, v, "bomb", "炸弹人炸弹")
  }
}

export function prophetCheck(state: GameState, sel: string): string | { name: string; isWolf: boolean } | null {
  if (!sel) return "请选择查验对象"
  // 使用角色系统查找预言家
  const prophet = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "预言家"
  })
  if (prophet && !prophet.alive) return "预言家已出局，本晚不能查验"
  if (prophet && prophet.mark.skillDisabled) return "预言家被恐惧，本夜无法查验"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  if (sel === NO_CHECK) {
    return prophetNoCheck(state)
  }
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能查验`
  // 隐狼验出金水（不与狼群见面）；黑化野孩子按狼计 → 查杀
  const isWolf = target.role !== "隐狼" && isEffectiveWolf(target)
  state.nightSteps.prophet = true
  const lbl = playerLabel(target)
  state.prophetReport = `${lbl} → ${isWolf ? "狼人" : "好人"}`
  pushNightLog(state, `🔮预言家查验${lbl}，结果：${isWolf ? "狼人" : "好人"}`)
  pushGlobalLog(state, `🔮预言家查验：${lbl} → ${isWolf ? "狼人" : "好人"}`)
  pushFlow(state, "预言家验人", sel, isWolf ? "狼" : "好")
  // 恶灵骑士反伤：查验触发目标角色的 onBeingChecked 钩子
  const targetRole = getRoleInstance(target.role)
  if (targetRole && targetRole.onBeingChecked) {
    targetRole.onBeingChecked(state, prophet ? prophet.name : "")
    target.mark.dreadKnightCheckedTonight = true
    target.mark.dreadKnightEverChecked = true
    // 反伤已用掉时，本次查验必然不会反伤，直接累计「吸引查验未反伤」
    if (target.mark.dreadKnightRevengeUsed) target.mark.dreadKnightCheckNoRevenge = true
  }
  // 记录验人结果用于记分（预言家存活时才记分）
  if (prophet && prophet.alive) {
    if (isWolf) prophet.mark.prophetCheckWolf = (prophet.mark.prophetCheckWolf || 0) + 1
    else prophet.mark.prophetCheckGood = true
  }
  return { name: sel, isWolf }
}

export function prophetNoCheck(state: GameState): string | null {
  // 使用角色系统查找预言家
  const prop = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "预言家"
  })
  if (!prop) return "本局没有预言家"
  // 预言家出局后仅流程性跳过，不扣分
  if (prop.alive) prop.mark.prophetNoCheckCount = (prop.mark.prophetNoCheckCount || 0) + 1
  state.nightSteps.prophet = true
  state.prophetReport = `${playerLabel(prop)} 本晚未验人`
  pushNightLog(state, `🔮预言家本晚未验人`)
  pushGlobalLog(state, `🔮预言家本晚不验人${prop.alive ? "，扣0.5分" : "（已出局，仅走流程）"}`)
  return null
}

/** 石像鬼查验：返回存活目标的完整身份（角色名）。不与狼人刀人步骤冲突。 */
export function gargoyleCheck(state: GameState, sel: string): string | { name: string; role: string } | null {
  if (!sel) return "请选择查验对象"
  const gargoyle = state.players.find((p) => getRoleInstance(p.role)?.def.id === "石像鬼")
  if (!gargoyle) return "本局没有石像鬼"
  if (!gargoyle.alive) return "石像鬼已出局，本晚不能查验"
  if (gargoyle.mark.skillDisabled) return "石像鬼本夜技能被封印，不能查验"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能查验`
  const role = target.role || "未分配"
  pushNightLog(state, `🗿石像鬼查验${playerLabel(target)}，身份：${role}`)
  pushGlobalLog(state, `🗿石像鬼查验：${playerLabel(target)} → ${role}`)
  pushFlow(state, "石像鬼验人", sel, role)
  return { name: sel, role }
}

/** 石像鬼是否已解锁刀人：除石像鬼外狼阵营全灭（黑化野孩子按生效狼计） */
export function gargoyleCanKill(state: GameState): boolean {
  const gargoyle = state.players.find((p) => getRoleInstance(p.role)?.def.id === "石像鬼")
  if (!gargoyle || !gargoyle.alive) return false
  const otherWolfAlive = state.players.some(
    (p) => p.alive && p.name !== gargoyle.name && isEffectiveWolf(p),
  )
  return !otherWolfAlive
}

/** 石像鬼刀人（解锁后）：写入狼刀口，视为普通狼刀（女巫/守卫生效） */
export function gargoyleKill(state: GameState, sel: string): string | null {
  const gargoyle = state.players.find((p) => getRoleInstance(p.role)?.def.id === "石像鬼")
  if (gargoyle?.mark.skillDisabled) return "石像鬼本夜技能被封印，不能刀人"
  if (!gargoyleCanKill(state)) return "石像鬼尚未解锁刀人能力"
  if (!sel) return "请选择被刀对象"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为刀人对象`
  if (isEffectiveWolf(target)) return `${sel}是狼阵营，石像鬼不能刀狼`
  state.nightWolfKill = sel
  state.wolfSelfKill = false
  if (gargoyle) gargoyle.mark.gargoyleKilledTonight = true
  pushNightLog(state, `🗿石像鬼刀人：${sel}`)
  pushGlobalLog(state, `🗿石像鬼刀人：${sel}`)
  pushFlow(state, "石像鬼刀人", sel)
  return null
}

/** 石像鬼空刀（解锁后，本夜不刀人） */
export function gargoyleEmptyKill(state: GameState): string | null {
  if (!gargoyleCanKill(state)) return "石像鬼尚未解锁刀人能力"
  state.nightWolfKill = ""
  state.wolfSelfKill = false
  pushNightLog(state, "🗿石像鬼空刀：本夜不刀人")
  pushGlobalLog(state, "🗿石像鬼空刀：本夜不刀人")
  pushFlow(state, "石像鬼刀人", "", "空刀")
  return null
}

/** 守墓人结果：上一白天被公投放逐者的阵营（null=无信息：无放逐/守墓人已出局/被封印） */
export function gravekeeperResult(state: GameState): { name: string; isWolf: boolean } | null {
  const gk = state.players.find((p) => getRoleInstance(p.role)?.def.id === "守墓人")
  if (!gk || !gk.alive) return null
  if (gk.mark.skillDisabled || state.bloodMoonSeal) return null
  const name = state.lastVoteOut
  if (!name) return null
  const p = state.players.find((x) => x.name === name)
  if (!p) return null
  return { name, isWolf: isEffectiveWolf(p) }
}

export function guardDo(state: GameState, sel: string, flagSame: boolean): string | null {
  if (!sel) return "请选择守护对象"
  // 使用角色系统查找守卫
  const guard = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "守卫"
  })
  if (!guard) return "本局没有守卫"
  if (!guard.alive) return "守卫已出局，本晚不能守人"
  if (guard.mark.skillDisabled) return "守卫被恐惧，本夜无法守人"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  const target = state.players.find((x) => x.name === sel)
  if (!target) return "未找到该玩家"
  if (!target.alive) return `${sel}已出局，不能作为守护对象`
  if (state.guardLastTarget && sel === state.guardLastTarget) {
    return `守卫不能连续两晚守同一人（${sel}上晚已被守）`
  }
  state.nightGuardTarget = sel
  state.nightSameSaveKill = flagSame
  state.nightSteps.guard = true
  pushNightLog(state, `🛡️守卫守护${sel}${flagSame ? "【同守同救触发】" : ""}`)
  pushGlobalLog(state, `🛡️守卫守护：${sel}${flagSame ? "（触发同守同救）" : ""}`)
  pushFlow(state, "守卫守人", sel, flagSame ? "同守同救" : "")
  if (flagSame) guard.mark.guardSameSaveKill = true
  return null
}

export function witchSave(state: GameState): string | null {
  const target = state.nightWolfKill
  if (!target) return "本晚还没有狼人刀人记录，无法使用解药"
  if (state.witchSaveUsed) return "解药已经全部使用过"
  if (state.nightUsedDrug !== null) return "本晚女巫已经使用过一瓶药，同一夜晚不能同时使用解药和毒药"
  // 使用角色系统查找女巫
  const witch = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "女巫"
  })
  if (!witch) return "本局没有女巫"
  if (!witch.alive) return "女巫已出局，本晚不能用药"
  if (witch.mark.skillDisabled) return "女巫被恐惧，本夜无法用药"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  if (target === witch.name && state.round > 1) return "女巫只有首夜可以自救，之后夜晚不能自救"
  state.witchSaveUsed = true
  state.nightUsedDrug = "save"
  state.nightWitchSave = target
  state.nightSteps.witch = true
  const t = state.players.find((x) => x.name === target)
  if (t && !isEffectiveWolf(t)) witch.mark.witchSaveGood = true
  if (t && isWolfRole(t.role) && state.wolfSelfKill && state.nightWolfKill === target) {
    t.mark.wolfSelfKillCheat = true
  }
  pushNightLog(state, `🧪女巫使用解药救${target}`)
  pushGlobalLog(state, `🧪女巫解药解救：${target}`)
  pushFlow(state, "女巫解药", target)
  return null
}

export function witchPoison(state: GameState, sel: string): string | null {
  if (!sel) return "请选择毒杀目标"
  if (state.witchPoisonUsed) return "毒药已经全部使用过"
  if (state.nightUsedDrug !== null) return "本晚女巫已经使用过一瓶药，同一夜晚不能同时使用解药和毒药"
  // 使用角色系统查找女巫
  const witch = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "女巫"
  })
  if (!witch) return "本局没有女巫"
  if (!witch.alive) return "女巫已出局，本晚不能用药"
  if (witch.mark.skillDisabled) return "女巫被恐惧，本夜无法用药"
  if (state.bloodMoonSeal) return "血月封印：本夜神职技能失效"
  if (sel === witch.name) return "女巫不能对自己用毒"
  const tar = state.players.find((x) => x.name === sel)
  if (!tar) return "未找到该玩家"
  if (!tar.alive) return `${sel}已出局，不能用毒药`
  state.witchPoisonUsed = true
  state.nightUsedDrug = "poison"
  state.nightWitchPoison = sel
  state.nightSteps.witch = true
  // 恶灵骑士：免疫夜间所有伤害（反伤用掉后仍不会被毒死；毒药照常消耗）
  // 猎魔人毒免；梦游者夜间免伤
  const tarRoleId = getRoleInstance(tar.role)?.def.id
  const isImmune = tarRoleId === "恶灵骑士" || tarRoleId === "猎魔人" || tar.mark.dreamShield
  if (tarRoleId === "恶灵骑士") {
    tar.mark.dreadKnightPoisonedTonight = true
    tar.mark.dreadKnightEverPoisoned = true
    // 反伤已用掉时，本次毒药必然不会反伤，直接累计「吸引毒药未反伤」
    if (tar.mark.dreadKnightRevengeUsed) tar.mark.dreadKnightPoisonNoRevenge = true
  }
  if (!isImmune && isEffectiveWolf(tar)) {
    witch.mark.witchPoWolf = true
  } else if (!isImmune) {
    witch.mark.witchPoGood = true
  }
  // 毒到猎/狼王：立即标记吞枪（猎人睁眼在女巫之后，需在睁眼时即告知枪已哑火）
  // 使用角色系统判断目标角色
  if (tar) {
    const tarRole = getRoleInstance(tar.role)
    if (tarRole) {
      if (tarRole.def.id === "猎人") tar.mark.hunterIsPoisoned = true
      if (tarRole.def.id === "狼王") tar.mark.wolfKingIsPoisoned = true
    }
  }
  pushNightLog(state, `🧪女巫撒毒${sel}`)
  pushGlobalLog(state, `🧪女巫毒药毒杀：${sel}`)
  pushFlow(state, "女巫毒药", sel)
  return null
}

/**
 * 统一夜间行动入口（Phase 2.1：动态化 nightSteps + 统一入口）
 * 替代分散的 wolfKill/guardDo/prophetCheck/witchPoison/witchSave/cupidConnect 等直接调用
 * 内部仍转发给原函数，保持行为不变，仅提供统一接口供 UI/自动化调用
 */
export function executeNightAction(
  state: GameState,
  roleKey: string,
  target?: string | string[],
  extra?: { flagSame?: boolean }
): string | null {
  switch (roleKey) {
    case "wolf":
      if (!target) return "请选择被刀对象"
      return wolfKill(state, target as string)
    case "wolfEmpty":
      return wolfEmptyKill(state)
    case "guard":
      if (!target) return "请选择守护对象"
      return guardDo(state, target as string, extra?.flagSame ?? false)
    case "prophet":
      if (!target) return "请选择查验对象"
      if (target === "__NOCHECK__") return prophetNoCheck(state)
      const pc = prophetCheck(state, target as string)
      if (typeof pc === "object") return null // 正常返回结果对象，无错误
      return pc
    case "witchSave":
      return witchSave(state)
    case "witchPoison":
      if (!target) return "请选择毒杀目标"
      return witchPoison(state, target as string)
    case "cupid":
      if (!target || (Array.isArray(target) && target.length !== 2)) return "请选择两位玩家作为情侣"
      return cupidConnect(state, target as string[])
    case "gargoyle": {
      if (!target) return "请选择查验对象"
      const gc = gargoyleCheck(state, target as string)
      if (typeof gc === "object") return null
      return gc
    }
    case "gargoyleKill":
      if (!target) return "请选择被刀对象"
      return gargoyleKill(state, target as string)
    case "gargoyleEmpty":
      return gargoyleEmptyKill(state)
    case "nightmare":
      if (!target) return "请选择恐惧对象"
      return nightmareFear(state, target as string)
    case "wildChild":
      if (!target) return "请选择榜样"
      return wildChildPick(state, target as string)
    case "hunterWolf":
      if (!target) return "请选择狩猎对象"
      return hunterHunt(state, target as string)
    case "dreamer":
      if (!target) return "请选择入梦对象"
      return dreamDo(state, target as string)
    default:
      return `未知夜间行动: ${roleKey}`
  }
}

export function hunterShootConfirm(state: GameState, tarName: string): string | null {
  // 使用角色系统查找猎人
  const hunter = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "猎人"
  })
  if (!hunter) return "本局没有猎人"
  if (!state.hunterShotPending) return "当前没有开枪时机（需猎人被刀或被放逐后才能开枪）"
  if (hunter.alive) return "猎人尚存活，未出局不能开枪！"
  if (hunter.mark.hunterIsPoisoned) return "猎人被毒，无法开枪！"
  if (!tarName) return "请选择被带走目标"
  const target = state.players.find((p) => p.name === tarName)
  if (!target) return "未找到目标玩家"
  killPlayer(state, tarName, "shot")
  if (isEffectiveWolf(target)) hunter.mark.hunterKillWolf = true
  else hunter.mark.hunterKillGood = true
  state.hunterShotPending = false
  state.hunterShotDone = true
  pushNightLog(state, `🔫猎人${hunter.name}开枪带走${tarName}`)
  pushGlobalLog(state, `🔫猎人${hunter.name}开枪带走：${tarName}`)
  pushFlow(state, "猎人开枪", tarName)
  return null
}

export function hunterGiveUpShot(state: GameState): string | null {
  // 使用角色系统查找猎人
  const hunter = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "猎人"
  })
  if (!hunter) return "本局没有猎人"
  if (!state.hunterShotPending) return "当前没有开枪时机"
  state.hunterShotPending = false
  state.hunterShotDone = true
  pushNightLog(state, `🔫猎人${hunter.name}放弃开枪`)
  pushGlobalLog(state, `🔫猎人${hunter.name}放弃开枪`)
  pushFlow(state, "猎人弃枪", hunter.name)
  return null
}

/** 狼王开枪（狼枪）：狼王出局后（被刀/放逐/带走，非被毒）可开枪带走一人 */
export function wolfKingShootConfirm(state: GameState, tarName: string): string | null {
  // 使用角色系统查找狼王
  const wk = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "狼王"
  })
  if (!wk) return "本局没有狼王"
  if (!state.wolfKingShotPending) return "当前没有开枪时机（需狼王被刀或被放逐后才能开枪）"
  if (wk.alive) return "狼王尚存活，未出局不能开枪！"
  if (wk.mark.wolfKingIsPoisoned) return "狼王被毒，无法开枪！"
  if (!tarName) return "请选择被带走目标"
  const target = state.players.find((p) => p.name === tarName)
  if (!target) return "未找到目标玩家"
  const targetRole = getRoleInstance(target.role)
  killPlayer(state, tarName, "shot")
  // 计分口径：带狼 -1；带神牌 +0.5；带平民/第三方不加分。
  // 人狼恋第三方（丘比特/情侣）一律不加分，狼恋人也不按狼枪计分。
  const isWgThird =
    getChainType(state) === "WG" && (target.role === "丘比特" || isLover(state, target.name))
  if (!isWgThird) {
    if (isEffectiveWolf(target)) wk.mark.wolfKingShotWolf = true
    else if (targetRole?.countsAsGod()) wk.mark.wolfKingShotGood = true
  }
  // 被带走的猎人能否开枪，由 HunterRole.onAfterDeath 处理
  state.wolfKingShotPending = false
  state.wolfKingShotDone = true
  pushNightLog(state, `🔫狼王${wk.name}开枪带走${tarName}`)
  pushGlobalLog(state, `🔫狼王${wk.name}开枪带走：${tarName}`)
  pushFlow(state, "狼王开枪", tarName)
  return null
}

export function wolfKingGiveUpShot(state: GameState): string | null {
  // 使用角色系统查找狼王
  const wk = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "狼王"
  })
  if (!wk) return "本局没有狼王"
  if (!state.wolfKingShotPending) return "当前没有开枪时机"
  state.wolfKingShotPending = false
  state.wolfKingShotDone = true
  pushNightLog(state, `🔫狼王${wk.name}放弃开枪`)
  pushGlobalLog(state, `🔫狼王${wk.name}放弃开枪`)
  pushFlow(state, "狼王弃枪", wk.name)
  return null
}

/** 骑士决斗（白天，每局一次）：戳狼则狼死，戳好人则骑士自己出局 */
export function knightDuel(state: GameState, tar: string): string | null {
  // 使用角色系统查找骑士
  const knight = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "骑士"
  })
  if (!knight) return "本局没有骑士"
  if (state.knightDuelUsed) return "骑士的决斗之剑已用过，本局不能再决斗"
  if (!knight.alive) return "骑士已出局，无法决斗"
  if (!tar) return "请选择决斗对象"
  const t = state.players.find((x) => x.name === tar)
  if (!t) return "未找到该玩家"
  if (!t.alive) return "该玩家已出局"
  if (t.name === knight.name) return "不能和自己决斗"
  state.knightDuelUsed = true
  if (isEffectiveWolf(t)) {
    killPlayer(state, tar, "duel")
    knight.mark.hunterKillWolf = true
    pushGlobalLog(state, `⚔️骑士${knight.name}决斗戳中狼人${tar}，狼人出局`)
    pushNightLog(state, `⚔️骑士决斗：${tar}是狼，被戳出局`)
    pushFlow(state, "骑士决斗", tar, "戳中狼")
  } else {
    killPlayer(state, knight.name, "duel")
    knight.mark.hunterKillGood = true
    pushGlobalLog(state, `⚔️骑士${knight.name}决斗戳错好人${tar}，骑士自己出局`)
    pushNightLog(state, `⚔️骑士决斗戳错，骑士出局`)
    pushFlow(state, "骑士决斗", tar, "戳错")
  }
  return null
}

/**
 * 公投放逐。bombVoters：炸弹人在场时勾选的投票名单（多选）。
 * 炸弹人先校验名单再放逐，防止放逐已生效却校验失败。
 */
export function finishVote(state: GameState, outName: string, idiotFlip: boolean, bombVoters?: string[]): string | null {
  if (state.skipVote) return "本日已因狼人自爆跳过投票，请进入夜晚开始新的一轮"
  if (!outName) return "请选择放逐出局对象"
  const outP = state.players.find((p) => p.name === outName)
  if (!outP) return "未找到该玩家"
  if (!outP.alive) return `${outName}已出局，无需放逐`
  // 使用角色系统判断是否为白痴
  const outRole = getRoleInstance(outP.role)
  const isIdiot = outRole && outRole.def.id === "白痴"
  // 白痴翻牌后不可被放逐
  if (isIdiot && outP.mark.idiotFlipped) {
    return "白痴已翻牌，无法被放逐出局"
  }
  // 炸弹人：放逐前校验票选名单（可多选，爆炸后无人生还独赢）
  const isBomber = outRole && outRole.def.id === "炸弹人"
  if (isBomber) {
    const err = validateBombVoters(state, outName, bombVoters ?? [])
    if (err) return err
  }
  if (isIdiot && !outP.mark.idiotFlipped && idiotFlip) {
    outP.mark.idiotFlipped = true
    outP.alive = true
    // 白痴翻牌未出局 → 本日无放逐，守墓人当夜无信息
    state.lastVoteOut = ""
    pushGlobalLog(state, `🙊白痴${outName}被放逐，翻牌免死（失去投票权）`)
    pushFlow(state, "放逐", outName, "白痴翻牌")
  } else if (isBomber) {
    // 爆炸与遗言期间挂起胜负；遗言结束后再判（期间 recordWin/checkWin 不生效）
    state.bombLastWordsPending = true
    state.lastBombBomber = outName
    state.lastBombVictims = []
    // 全票判定按“投票前”的存活名单（炸弹人的情侣可能随后殉情，不能因此误报全票）
    const voterSet = [...new Set((bombVoters ?? []).filter(Boolean))]
    const aliveOthersBefore = state.players.filter((p) => p.alive && p.name !== outName)
    const allVoted = aliveOthersBefore.length > 0 && aliveOthersBefore.every((p) => voterSet.includes(p.name))
    // 先出局再引爆（引爆用校验过的名单）
    killPlayer(state, outName, "vote")
    state.lastVoteOut = outName
    pushGlobalLog(state, `⚖️投票放逐出局：${outName}`)
    pushFlow(state, "放逐", outName)
    bombExileDetonate(state, outP, bombVoters ?? [], allVoted)
    // 爆炸结算完成后存活人数为 0 → 炸弹人独赢（全票是其子集；情侣殉情导致的 0 人也算）
    if (state.players.every((p) => !p.alive)) {
      state.bombVictory = true
      pushGlobalLog(state, `💣炸弹人${outName}引爆后场上无人生还，达成独赢！`)
      pushFlow(state, "炸弹人独赢", outName, "爆炸后无人存活")
    }
  } else {
    // 血月使徒仅剩狼被放逐 → 延迟出局：当晚可行动/自爆，天亮死亡
    const isBloodMoon = outRole && outRole.def.id === "血月使徒"
    const lastWolf = isBloodMoon && !state.players.some((x) => x.alive && x.name !== outName && isEffectiveWolf(x))
    if (lastWolf) {
      outP.mark.bloodDelayedExile = true
      pushGlobalLog(state, `🌕血月使徒${outName}被放逐，血月之力延续到天亮（可行动/自爆）`)
      pushFlow(state, "放逐", outName, "血月延迟出局")
    } else {
      killPlayer(state, outName, "vote")
      pushGlobalLog(state, `⚖️投票放逐出局：${outName}`)
      pushFlow(state, "放逐", outName)
      // 使用角色系统判断是否为猎人/狼王
      if (outRole && outRole.def.id === "猎人" && !outP.mark.hunterIsPoisoned) {
        state.hunterShotPending = true
        pushGlobalLog(state, `🔫猎人${outName}被放逐，可开枪（放逐后立即处理）`)
      }
      if (outRole && outRole.def.id === "狼王" && !outP.mark.wolfKingIsPoisoned) {
        state.wolfKingShotPending = true
        pushGlobalLog(state, `🔫狼王${outName}被放逐，可开枪`)
      }
    }
    // 记录白天公投出局者（守墓人次夜读取；血月延迟也计入，天亮结算死讯）
    state.lastVoteOut = outName
  }
  // 本日投票已结束：之后不能再自爆（只能在此前的警上/放逐发言阶段自爆）
  state.uiDone.vote = true
  return null
}

/** 炸弹人遗言队列结束：恢复胜负判定（爆炸/遗言期间 recordWin/checkWin 挂起） */
export function finishBombLastWords(state: GameState): void {
  if (!state.bombLastWordsPending) return
  state.bombLastWordsPending = false
  recordWinEvent(state)
}

export function wolfBaoZha(state: GameState, sel: string): string | null {
  if (!sel) return "请选择自爆的狼人"
  const p = state.players.find((x) => x.name === sel)
  if (!p) return "未找到该玩家"
  if (!p.alive) return "该玩家已出局"
  if (!isEffectiveWolf(p)) return "只能狼阵营玩家自爆"
  if (getRoleInstance(p.role)?.def.id === "狼美人") return "狼美人不能自爆"
  if (getRoleInstance(p.role)?.def.id === "石像鬼") return "石像鬼不能自爆"
  if (getRoleInstance(p.role)?.def.id === "恶灵骑士") return "恶灵骑士不能自爆"
  // 自爆只能在警上发言 / 放逐发言阶段（投票之前）
  if (p.mark.bloodDelayedExile) return "已被放逐出局，不能自爆"
  if (state.uiDone?.vote) return "投票已结束，只能在警上/放逐发言阶段自爆"
  if (state.skipVote) return "本日已自爆/跳过投票，请直接进入夜晚"
  // 警上自爆：结束竞选、跳过天亮后的白天（首夜末尾的警长竞选）
  const isJinghuiSelfBomb = state.phase === "night" && state.round <= 1
  if (isJinghuiSelfBomb) {
    state.skipDayAfterDawn = true
    state.uiDone.jinghui = true
  }
  killPlayer(state, sel, "selfBomb")
  state.skipVote = true
  // 血月使徒自爆：当夜神职技能全部失效
  if (getRoleInstance(p.role)?.def.id === "血月使徒") {
    state.bloodMoonSeal = true
    // 警上自爆发生在天亮前：封印顺延到下一夜
    if (isJinghuiSelfBomb) state.bloodSealNextNight = true
    p.mark.bloodSealCount = (p.mark.bloodSealCount || 0) + 1
    pushGlobalLog(state, `🌕血月当空！今夜神职技能全部失效！`)
    pushFlow(state, "血月封印", sel, "当夜神职失效")
  }
  // 注意：不在此清空 lastVoteOut —— 若当日已公投放逐，放逐信息仍应保留给守墓人；
  // 若尚未投票，lastVoteOut 本就在黎明被清空，守墓人当夜无信息。
  // 自爆直接吞警徽：自爆者是警长则警徽流失
  if (state.jingHui === sel) loseBadge(state, sel, "自爆")
  pushGlobalLog(state, `💥狼人自爆：${sel}，本日跳过投票`)
  pushFlow(state, "狼人自爆", sel)
  return null
}

/** 白狼王自爆带人：白狼王与目标一同出局，跳过本日投票 */
export function wolfKingBaoZha(state: GameState, sel: string, tar: string): string | null {
  if (!sel) return "请选择自爆的白狼王"
  if (!tar) return "请选择带走的目标"
  const p = state.players.find((x) => x.name === sel)
  if (!p) return "未找到该玩家"
  if (!p.alive) return "该玩家已出局"
  const pRole = getRoleInstance(p.role)
  if (!pRole || pRole.def.id !== "白狼王") return "只能选择白狼王自爆带人"
  const t = state.players.find((x) => x.name === tar)
  if (!t) return "未找到目标玩家"
  if (!t.alive) return "目标已出局"
  if (t.name === p.name) return "不能带走自己"
  // 自爆只能在警上发言 / 放逐发言阶段（投票之前）
  if (state.uiDone?.vote) return "投票已结束，只能在警上/放逐发言阶段自爆"
  if (state.skipVote) return "本日已自爆/跳过投票，请直接进入夜晚"
  // 警上自爆：结束竞选、跳过天亮后的白天
  if (state.phase === "night" && state.round <= 1) {
    state.skipDayAfterDawn = true
    state.uiDone.jinghui = true
  }
  killPlayer(state, sel, "selfBomb")
  killPlayer(state, tar, "other")
  // 记录自爆带走目标，供计分判定（女巫有药 / 守卫 / 未开技能骑士 +0.5）
  p.mark.wolfBombTarget = tar
  state.skipVote = true
  // 同狼人自爆：不清空 lastVoteOut（当日已放逐则保留，未放逐则黎明已为空）
  // 白狼王自爆带走：被带走的猎人/狼王不开枪；若白狼王是警长则警徽流失
  if (state.jingHui === sel) loseBadge(state, sel, "自爆")
  pushGlobalLog(state, `💥白狼王${sel}自爆，带走${tar}，本日跳过投票`)
  pushFlow(state, "白狼王自爆", tar)
  return null
}

/** 天亮结算：把夜间操作结算成死亡，返回死亡名单 */
export function resolveNightDeath(state: GameState): string | null {
  // Phase 4：使用新的角色驱动夜晚结算器
  return resolveNightEffects(state)
}

import { resolveNightEffects } from "./night-resolver"
import { getRoleInstance } from "./roles/builtin"

// ===================== 实时算分 =====================

export function recalcScore(state: GameState): void {
  const win = state.winCamp
  // 狼群存活加成：只算狼群角色（不含石像鬼/隐狼/黑化野孩子；人狼恋第三方不计）
  const wgChain = getChainType(state) === "WG"
  const wolfPackMembers = state.players.filter(
    (p) => isWolfPackRole(p.role) && !(wgChain && isThirdMember(state, p)),
  )
  const wolfPackAllAlive = wolfPackMembers.length > 0 && wolfPackMembers.every((p) => p.alive)
  const wolfPackCount = wolfPackMembers.length
  state.players.forEach((p) => {
    const detail: string[] = []
    let s = 0

    // Phase 5：使用角色系统的 scoreRules
    const role = getRoleInstance(p.role)
    if (role && role.scoreRules) {
      const entries = role.scoreRules(state, p as unknown as { name: string; role: string; mark: Record<string, unknown> })
      for (const entry of entries) {
        s += entry.delta
        detail.push(`${entry.reason}${entry.delta >= 0 ? "+" : ""}${entry.delta}`)
      }
    }

    // 人狼恋第三方成员（丘比特/恋人）：第三方存在时，好人/狼胜均不计入对应阵营分
    const isWGCamp = getChainType(state) === "WG" && isThirdMember(state, p)

    // MVP/SVP/背锅侠
    if (state.mvp === p.name) {
      s += 1
      detail.push("MVP+1")
    }
    if (state.svp === p.name) {
      s += 0.5
      detail.push("SVP+0.5")
    }
    if (state.beiguo === p.name) {
      s -= 0.5
      detail.push("背锅侠-0.5")
    }

    // 阵营胜利分（保留在 logic.ts 中，因为涉及全局胜负逻辑）
    // 狼人胜利：真狼 +3（狼狼恋无第三方，丘比特属好人不计狼胜分；人狼恋狼恋人属第三方不计狼胜；黑化野孩子按狼计）
    if (win === "wolf" && isEffectiveWolf(p) && !isWGCamp) {
      s += 3
      detail.push("狼人胜利+3")
      // 狼群全员存活才加成（石像鬼/隐狼/黑化野孩子不计入，也不拿此加成）
      if (p.alive && wolfPackAllAlive && wolfPackMembers.some((w) => w.name === p.name)) {
        if (wolfPackCount >= 4) {
          s += 1
          detail.push("狼群全存活·4狼+1")
        } else if (wolfPackCount === 3) {
          s += 0.5
          detail.push("狼群全存活·3狼+0.5")
        }
      }
    }
    // 好人胜利（狼全灭）：神职与平民同时拿基础分（人狼恋第三方成员除外）
    if ((win === "god" || win === "civil") && GOD_LIST.includes(p.role) && !isWGCamp) {
      s += 3
      detail.push("神职胜利+3")
    }
    // 使用角色系统判断平民角色（黑化野孩子按狼计，不再拿平民分）
    const pRole = getRoleInstance(p.role)
    if ((win === "god" || win === "civil") && pRole && pRole.def.camp === "villager" && !p.mark.isTransform && !isWGCamp) {
      s += 2
      detail.push("平民胜利+2")
    }
    if (win === "third" && state.winningThird === "WG" && isThirdMember(state, p)) {
      s += 3
      detail.push("第三方胜利+3")
    }
    // 丘比特：人人/狼狼恋(无第三方)属好人，好人胜+3；人狼恋属第三方，第三方胜+3、好人/狼胜不加分
    if ((win === "god" || win === "civil") && pRole && pRole.def.id === "丘比特" && getChainType(state) !== "WG") {
      s += 3
      detail.push("好人胜利·丘比特+3")
    }

    p.scoreRound = Math.round(s * 10) / 10
    p.scoreDetail = detail
  })
}

export const WIN_TEXT: Record<"wolf" | "god" | "civil" | "third" | "draw", string> = {
  wolf: "狼人胜利",
  god: "神职胜利",
  civil: "平民胜利",
  third: "第三方胜利",
  draw: "平局",
}

/** 第三方成员：丘比特 + 两位恋人（人狼恋时三人一体） */
export function isThirdMember(state: GameState, p: Player): boolean {
  // 只有人狼恋（WG）才形成第三方；GG/WW 的丘比特是神，不是第三方
  if (getChainType(state) !== "WG") return false
  const role = getRoleInstance(p.role)
  return (role && role.def.id === "丘比特") || isLover(state, p.name)
}

/** 若该玩家属于人狼恋第三方，返回"第三阵营·原角色"标注，否则返回空串 */
export function thirdCampLabel(state: GameState, p: Player): string {
  if (getChainType(state) !== "WG") return ""
  if (!isThirdMember(state, p)) return ""
  return `第三阵营·${p.role}`
}

/** 自动判定胜负；返回是否"本次刚判出胜负"、胜负文案及原因（用于弹窗） */
export function checkWin(state: GameState): { ended: boolean; text: string; reason: string } {
  // Phase 5：使用角色驱动的胜负判定
  return checkWinRoleDriven(state)
}

import { checkWin as checkWinRoleDriven, recordWin as recordWinEvent } from "./win-checker"

// ===================== 荣誉 / 结算 / 导出 =====================

export function applyHonor(state: GameState, mvp: string, svp: string, beiguo: string): void {
  state.mvp = mvp
  state.svp = svp
  state.beiguo = beiguo
  pushGlobalLog(state, `🏆荣誉：MVP=${mvp || "-"},SVP=${svp || "-"},背锅侠=${beiguo || "-"}`)
}

/** 根据对局自动建议 MVP/SVP：胜方第一比第二≥2分且有高光→MVP；败方同理→SVP；否则空 */
export function suggestHonor(state: GameState): { mvp: string; svp: string } {
  const win = state.winCamp
  if (!win || win === "third") return { mvp: "", svp: "" }
  const winnerIsWolf = win === "wolf"
  const winners = state.players
    .filter((p) => (winnerIsWolf ? isEffectiveWolf(p) : !isEffectiveWolf(p)))
    .sort((a, b) => b.scoreRound - a.scoreRound)
  const losers = state.players
    .filter((p) => (winnerIsWolf ? !isEffectiveWolf(p) : isEffectiveWolf(p)))
    .sort((a, b) => b.scoreRound - a.scoreRound)

  // Phase 6：使用角色系统的 highlight
  const highlight = (p: Player): boolean => {
    const role = getRoleInstance(p.role)
    if (role && role.highlight) {
      return role.highlight(p as unknown as { name: string; role: string; mark: Record<string, unknown> })
    }
    return false
  }

  const pick = (arr: Player[]): string => {
    if (arr.length < 2) return ""
    return arr[0].scoreRound - arr[1].scoreRound >= 2 && highlight(arr[0]) ? arr[0].name : ""
  }
  return { mvp: pick(winners), svp: pick(losers) }
}

export function resetRoundScore(state: GameState): void {
  state.players.forEach((p) => (p.scoreRound = 0))
}

/**
 * 连续劣势达到多少次才算「这一方真的被压制过」。
 * 求解器 B 档的结论会随行动方翻转（狼人一刀就变成狼人占优），
 * 单次观察到的劣势多半只是「轮到谁动手」，直接记会让每局都挂上绝地翻盘。
 */
export const UNDERDOG_MIN_STREAK = 2

/**
 * 记下「本局这个阵营处于劣势」。由 UI 在观察到求解器结论时调用。
 * 同一阵营连续 UNDERDOG_MIN_STREAK 次才算真正被压制过，才计入 underdogs；
 * 已计入过的阵营不重复计数，只更新连续次数。
 */
export function noteUnderdog(state: GameState, camp: Camp): boolean {
  if (state.finished) return false
  if (state.underdogCamp === camp) state.underdogStreak++
  else {
    state.underdogCamp = camp
    state.underdogStreak = 1
  }
  if (state.underdogs.includes(camp)) return false
  if (state.underdogStreak < UNDERDOG_MIN_STREAK) return false
  state.underdogs.push(camp)
  return true
}

export function finishGameAuto(state: GameState, forced?: { camp: WinCamp; reason: string }): string | null {
  if (state.finished) return "本局已结算，请勿重复结算"
  if (state.players.length === 0) return "还没有玩家，无法结算"
  let forcedReason = ""
  if (forced) {
    if (!forced.camp) return "无法判定胜负"
    state.winCamp = forced.camp
    forcedReason = forced.reason
  } else if (!state.winCamp) {
    checkWin(state)
    if (!state.winCamp) return "无法判定胜负（狼人和好人仍同时存在）"
  }
  recalcScore(state)
  state.players.forEach((p) => {
    p.scoreTotal = Math.round((p.scoreTotal + p.scoreRound) * 10) / 10
  })
  state.finished = true
  if (state.judge) {
    state.judgeScores[state.judge] = Math.round(((state.judgeScores[state.judge] || 0) + 0.5) * 10) / 10
    pushGlobalLog(state, `⚖️法官 ${state.judge} 主持本局 +0.5，累计 ${state.judgeScores[state.judge]} 分`)
  }
  // 绝地翻盘：结算前曾以 1% 弱势方身份出现的阵营赢了
  const winnerCamp: Camp | null =
    state.winCamp === "third" || state.winCamp === "draw" || !state.winCamp ? null : state.winCamp === "wolf" ? "wolf" : "good"
  if (winnerCamp && state.underdogs.includes(winnerCamp)) {
    state.comeback = true
    pushGlobalLog(state, `🔥绝地翻盘：${WIN_TEXT[state.winCamp]}曾在这局里被持续压制，硬是翻了回来`)
  }
  const forcedTag = forcedReason ? `（提前结束：${forcedReason}）` : ""
  const comebackTag = state.comeback ? "【绝地翻盘】" : ""
  pushGlobalLog(state, `🏁一键完整结算完成：${comebackTag}${WIN_TEXT[state.winCamp]}${forcedTag}，各玩家本轮分已固化到总分`)
  return null
}

export function buildAutoRecord(state: GameState, title?: string): string {
  let txt = "====狼人杀对局复盘====\n"
  if (title) txt = `====${title}====\n`
  txt += `板子：${state.board}\n胜利阵营：${state.winCamp ? WIN_TEXT[state.winCamp] : "未结束"}\n`
  if (state.lovers.length) {
    const chain = getChainType(state)
    const chainText = chain === "WG" ? "人狼恋·第三方" : chain === "WW" ? "狼狼恋" : chain === "GG" ? "人人恋" : "待判定"
    txt += `情侣：${state.lovers.join(" ❤ ")}（${chainText}）\n`
  }
  if (state.judge) txt += `法官：${state.judge}（+0.5/局，累计 ${state.judgeScores[state.judge] || 0} 分）\n`
  if (state.underdogs.length) {
    txt += `曾持续处于劣势：${state.underdogs.map((c) => (c === "wolf" ? "狼人" : "好人")).join("、")}\n`
  }
  if (state.comeback) txt += `绝地翻盘：🔥 ${state.winCamp ? WIN_TEXT[state.winCamp] : "胜方"}从被压制局面翻盘获胜\n`
  state.players.forEach((p) => {
    txt += `玩家【${p.name}】身份：${p.role}，${p.alive ? "存活" : "出局"}，本轮分：${p.scoreRound.toFixed(1)}，总分：${p.scoreTotal.toFixed(1)}（${p.scoreDetail.join("；") || "无加分"}）\n`
  })
  txt += "\n====完整对局日志====\n"
  txt += state.globalLog
    .map((l, i) => `${i + 1}. ${decorateLog(state, cleanLogLine(l))}`)
    .join("\n")
  return txt
}

/** 结算统计：按阵营统计已分配身份的玩家数量（全量，含出局） */
export function campPlayerCounts(state: GameState): { wolf: number; god: number; villager: number; third: number } {
  let wolf = 0
  let god = 0
  let villager = 0
  let third = 0
  const wg = getChainType(state) === "WG"
  for (const p of state.players) {
    if (!p.role) continue
    // 人狼恋第三方：丘比特 + 两情侣统一归第三方，不再按底牌重复计入狼/神/民
    if (wg && isThirdMember(state, p)) {
      third++
      continue
    }
    const role = getRoleInstance(p.role)
    // 炸弹人是独立第三方
    if (role?.def.id === "炸弹人") {
      third++
      continue
    }
    // 黑化野孩子按生效阵营计狼，不再算平民
    if (isEffectiveWolf(p)) {
      wolf++
      continue
    }
    // 非人狼恋的丘比特是神
    if (role?.def.id === "丘比特") {
      god++
      continue
    }
    const camp = getRole(p.role)?.camp
    if (camp === "wolf") wolf++
    else if (camp === "god") god++
    else if (camp === "villager") villager++
    else if (camp === "third") third++
  }
  return { wolf, god, villager, third }
}

/** 各阵营角色分配摘要（用于结算展示） */
export function campBreakdown(state: GameState): string {
  const wolves = state.players.filter((p) => isEffectiveWolf(p))
  const gods = state.players.filter((p) => GOD_LIST.includes(p.role))
  const civils = state.players.filter((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.camp === "villager" && !p.mark.isTransform
  })
  const cupid = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "丘比特"
  })
  const fmt = (arr: Player[]) => (arr.length ? arr.map((p) => `${p.no || 0}.${p.name}(${p.role})`).join("、") : "无")
  let txt = `🐺狼人阵营：${fmt(wolves)}\n🔮神职阵营：${fmt(gods)}\n👤平民阵营：${fmt(civils)}`
  // 独立第三方角色（炸弹人等，不含丘比特——丘比特随情侣阵营一起展示）
  const otherThird = state.players.filter((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.camp === "third" && role.def.id !== "丘比特"
  })
  if (otherThird.length) txt += `\n💣第三方阵营：${fmt(otherThird)}`
  if (cupid || state.lovers.length) {
    const thirdMembers = state.players.filter((p) => {
      const role = getRoleInstance(p.role)
      return (role && role.def.id === "丘比特") || isLover(state, p.name)
    })
    txt += `\n💘情侣阵营：${fmt(thirdMembers)}${getChainType(state) === "WG" ? "（人狼恋·第三方）" : "（丘比特属好人）"}`
  }
  return txt
}

export function buildCSV(state: GameState): string {
  const campMap: Record<string, string> = { wolf: "狼人", god: "神职", civil: "平民", third: "第三方" }
  const rows: string[][] = [["玩家", "身份", "存活", "技能分明细", "本轮分", "总分"]]
  state.players.forEach((p) => {
    rows.push([p.name, p.role, p.alive ? "存活" : "出局", p.scoreDetail.join("；") || "-", p.scoreRound.toFixed(1), p.scoreTotal.toFixed(1)])
  })
  rows.push(["板子", state.board, "", "", "", ""])
  rows.push(["胜利阵营", state.winCamp ? campMap[state.winCamp] : "未结束", "", "", "", ""])
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n")
}

// ===================== 角色系统初始化 =====================

import { ensureBuiltinRoles } from "./roles/builtin"
ensureBuiltinRoles()