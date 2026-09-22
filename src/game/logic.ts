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
  "6a": "6人竞技｜2狼+预言家+猎人+2平民",
  "6b": "6人娱乐｜2狼+预言家+女巫+2平民",
  "7a": "7人竞技｜2狼+预言家+猎人+3平民",
  "7b": "7人娱乐｜2狼+女巫+4平民",
  "8a": "8人竞技预女猎｜3狼+预言家+女巫+猎人+2平民",
  "8b": "8人预女猎守｜2狼+预言家+女巫+猎人+守卫+2平民",
  "9": "9人标准预女猎｜3狼+预言家+女巫+猎人+3平民",
  "10": "10人标准｜3狼+预言家+女巫+猎人+4平民",
  "11": "11人标准｜3狼+预言家+女巫+猎人+5平民",
  "12": "12人预女猎白｜4狼+预言家+女巫+猎人+白痴+4平民",
  "13": "13人预女猎白扩｜4狼+预言家+女巫+猎人+白痴+5平民",
  "12k": "12人预女猎骑白｜3狼+预言家+女巫+猎人+骑士+白痴+4平民",
  "12q": "12人预女猎丘｜4狼+预言家+女巫+猎人+丘比特+4平民",
  "13w": "13人白狼王｜白狼王+3狼+预言家+女巫+猎人+白痴+5平民",
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
  prophetFirstDayWolf: boolean
  prophetCheckWolf: boolean
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
  guardHitCount: number
  guardSameSaveKill: boolean
  wolfHanTiaoJinghui: boolean
  wolfSelfKillCheat: boolean
  idiotFlipped: boolean
  voteTarget: string
  voteWolfCount: number
  voteGoodCount: number
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
export type Phase = "idle" | "night" | "day"

export const DEFAULT_VOICES: Record<string, string> = {
  night_start: "天黑请闭眼。",
  cupid: "丘比特请睁眼！指认你选定的两位情侣，让大家感受爱情，看完赶紧闭眼。",
  cupid_close: "丘比特请闭眼。",
  lovers_meet: "被选中的情侣请睁眼，互相认识一下。",
  lovers_close: "情侣请闭眼。",
  wolf: "狼崽子睁眼！认认你的同伙，商量今晚刀哪个大冤种，密谋完赶紧闭眼装好人。",
  wolf_king_gesture: "狼王、白狼王请举手示意，法官确认！",
  wolf_close: "狼人请闭眼。",
  prophet: "算命大仙请睁眼！扒开一位玩家的底牌，看完把嘴捂严实，闭眼！",
  prophet_close: "预言家请闭眼。",
  guard: "夜班保镖上线！记住别连续保同一个人，挑好保护对象麻溜闭眼。",
  guard_close: "守卫请闭眼。",
  witch: "药罐子女巫请睁眼！今晚被刀的是某玩家。救不救？毒药要不要给谁上点强度，想明白再闭眼。",
  witch_close: "女巫请闭眼。",
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
  explode: "狼人自爆：直接摆烂摊牌，不演了！白天结束全体闭眼入夜。",
  hunter: "枪哥，猎枪已上膛，逮个倒霉蛋过来陪葬！",
  hunter_poisoned: "毒药直接把枪腐蚀锈死啦，彻底哑火开不了！",
  idiot_flip: "显眼包亮身份赖场不走！以后没投票权，白天投不死，只能夜里搞他。",
  knight_duel_wolf: "骑士一剑戳中大灰狼！狼人直接寄，火速入夜！",
  knight_duel_good: "骑士看走眼翻车，自己白给，继续盘！",
  wwk_boom: "白狼王掀桌自爆！顺手薅走一个，直接入夜。",
  jinghui: "现在竞选警长。",
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
  nightSteps: { guard: boolean; wolf: boolean; prophet: boolean; witch: boolean }
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
  /** 模拟对局模式：不同步飞书 */
  simMode: boolean
  /** 是否已在首页选择了对局模式（唯一首页入口，选择后才可进入） */
  modeChosen: boolean
}

export function defaultMark(): Mark {
  return {
    prophetFirstDayWolf: false,
    prophetCheckWolf: false,
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
    guardHitCount: 0,
    guardSameSaveKill: false,
    wolfHanTiaoJinghui: false,
    wolfSelfKillCheat: false,
    idiotFlipped: false,
    voteTarget: "",
    voteWolfCount: 0,
    voteGoodCount: 0,
  }
}

export function defaultState(): GameState {
  return {
    board: "6a",
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
    nightSteps: { guard: false, wolf: false, prophet: false, witch: false },
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
    simMode: true,
    modeChosen: false,
  }
}

export function normalizeState(s: GameState): GameState {
  const base = defaultState()
  const st: GameState = Object.assign(base, s)
  st.voices = Object.assign({ ...DEFAULT_VOICES }, s.voices || {})
  if (st.voices.witch && st.voices.witch.includes("{killed}")) {
    st.voices.witch = DEFAULT_VOICES.witch
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
  if (typeof st.simMode !== "boolean") st.simMode = true
  if (typeof st.modeChosen !== "boolean") st.modeChosen = false
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
  return null
}

/** 批量确认狼人（狼人睁眼时由法官一次确认） */
export function confirmWolves(state: GameState, names: string[]): string | null {
  // 使用角色系统查找狼人角色ID
  const wolfRoleId = Object.keys(roleQuota(state)).find((r) => {
    const role = getRoleInstance(r)
    return role && role.def.camp === "wolf"
  }) || "狼人"
  const need = roleQuota(state)[wolfRoleId] || 0
  const now = state.players.filter((p) => p.role === wolfRoleId).length
  const unassigned = [...new Set(names)].filter(
    (n) => n && !state.players.find((p) => p.name === n)?.role,
  )
  if (now + unassigned.length > need) {
    return `狼人已确认 ${now} 个，本板子需要 ${need} 个，最多还能确认 ${need - now} 个`
  }
  for (const n of unassigned) confirmRole(state, n, wolfRoleId)
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
  state.nightSteps = { guard: false, wolf: false, prophet: false, witch: false }
  state.guardLastTarget = ""
  state.hunterShotPending = false
  state.hunterShotDone = false
  state.wolfKingShotPending = false
  state.wolfKingShotDone = false
  state.prophetReport = ""
  state.skipVote = false
  state.winCamp = null
  state.jingHui = ""
  state.wolfSelfKill = false
  state.knightDuelUsed = false
  state.mvp = ""
  state.svp = ""
  state.beiguo = ""
  state.finished = false
  state.lovers = []
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

/** 链型：GG 人人恋 / WW 狼狼恋 / WG 人狼恋；身份未全部确认时返回空串 */
export function getChainType(state: GameState): "GG" | "WW" | "WG" | "" {
  const [a, b] = state.lovers
  if (!a || !b) return ""
  const pa = state.players.find((p) => p.name === a)
  const pb = state.players.find((p) => p.name === b)
  if (!pa || !pb || !pa.role || !pb.role) return ""
  const aw = isWolfRole(pa.role)
  const bw = isWolfRole(pb.role)
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
      killed.push(partnerName)
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
export function killPlayer(state: GameState, name: string, reason: DieReason): string[] {
  const p = state.players.find((x) => x.name === name)
  if (!p || !p.alive) return []

  // 触发死亡前钩子（角色可拦截死亡，如白痴翻牌）
  const evt = { name, reason }
  for (const hook of beforeDeathHooks) {
    if (hook(state, evt)) {
      // 被拦截：不执行死亡
      return []
    }
  }

  p.alive = false
  p.deathReason = reason
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
  const modeChosen = state.modeChosen
  const s = defaultState()
  s.board = board
  s.boardRoles = boardRoles
  s.judge = judge
  s.judgeScores = judgeScores
  s.winMode = winMode
  s.simMode = simMode
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
  state.nightSteps = { guard: false, wolf: false, prophet: false, witch: false }
  state.guardLastTarget = ""
  state.hunterShotPending = false
  state.hunterShotDone = false
  state.wolfKingShotPending = false
  state.wolfKingShotDone = false
  state.prophetReport = ""
  state.skipVote = false
  state.winCamp = null
  state.jingHui = ""
  state.wolfSelfKill = false
  state.knightDuelUsed = false
  state.mvp = ""
  state.svp = ""
  state.beiguo = ""
  state.finished = false
  state.lovers = []
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
  state.nightSteps = { guard: false, wolf: false, prophet: false, witch: false }
  state.hunterShotPending = false
  state.wolfKingShotPending = false
  state.prophetReport = ""
  state.skipVote = false
  pushGlobalLog(state, `🌙第${state.round}晚，夜晚降临`)
  pushNightLog(state, `🌙第${state.round}晚开始`)
}

export function wolfKill(state: GameState, sel: string): string | null {
  if (!sel) return "请选择被刀对象"
  const target = state.players.find((x) => x.name === sel)
  const isSelf = target ? isWolfRole(target.role) : false
  // 情侣不能互刀：狼恋人不可作为刀人目标
  if (target && isLover(state, sel) && isWolfRole(target.role)) {
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

export function prophetCheck(state: GameState, sel: string): string | { name: string; isWolf: boolean } | null {
  if (!sel) return "请选择查验对象"
  // 使用角色系统查找预言家
  const prophet = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "预言家"
  })
  if (prophet && !prophet.alive) return "预言家已出局，本晚不能查验"
  if (sel === NO_CHECK) {
    return prophetNoCheck(state)
  }
  const target = state.players.find((x) => x.name === sel)
  const isWolf = target ? isWolfRole(target.role) : false
  state.nightSteps.prophet = true
  const lbl = target ? playerLabel(target) : sel
  state.prophetReport = `${lbl} → ${isWolf ? "狼人" : "好人"}`
  pushNightLog(state, `🔮预言家查验${lbl}，结果：${isWolf ? "狼人" : "好人"}`)
  pushGlobalLog(state, `🔮预言家查验：${lbl} → ${isWolf ? "狼人" : "好人"}`)
  pushFlow(state, "预言家验人", sel, isWolf ? "狼" : "好")
  // 记录验人结果用于记分（预言家存活时才记分）
  if (prophet && prophet.alive) {
    if (isWolf) prophet.mark.prophetCheckWolf = true
    else prophet.mark.prophetCheckGood = true
  }
  // 首夜验狼额外加分
  if (state.round === 1 && isWolf) {
    if (prophet && prophet.alive) prophet.mark.prophetFirstDayWolf = true
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

export function guardDo(state: GameState, sel: string, flagSame: boolean): string | null {
  if (!sel) return "请选择守护对象"
  // 使用角色系统查找守卫
  const guard = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "守卫"
  })
  if (!guard) return "本局没有守卫"
  if (!guard.alive) return "守卫已出局，本晚不能守人"
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
  if (target === witch.name && state.round > 1) return "女巫只有首夜可以自救，之后夜晚不能自救"
  state.witchSaveUsed = true
  state.nightUsedDrug = "save"
  state.nightWitchSave = target
  state.nightSteps.witch = true
  const t = state.players.find((x) => x.name === target)
  if (t && !isWolfRole(t.role)) witch.mark.witchSaveGood = true
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
  if (sel === witch.name) return "女巫不能对自己用毒"
  const tar = state.players.find((x) => x.name === sel)
  state.witchPoisonUsed = true
  state.nightUsedDrug = "poison"
  state.nightWitchPoison = sel
  state.nightSteps.witch = true
  if (tar && isWolfRole(tar.role)) witch.mark.witchPoWolf = true
  else if (tar) witch.mark.witchPoGood = true
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
  if (isWolfRole(target.role)) hunter.mark.hunterKillWolf = true
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
  killPlayer(state, tarName, "shot")
  if (isWolfRole(target.role)) wk.mark.wolfKingShotWolf = true
  else wk.mark.wolfKingShotGood = true
  // 狼枪带走猎人：猎人依然可开枪（非被毒）
  // 使用角色系统判断目标是否为猎人
  const targetRole = getRoleInstance(target.role)
  if (targetRole && targetRole.def.id === "猎人" && !target.mark.hunterIsPoisoned) {
    state.hunterShotPending = true
    pushGlobalLog(state, `🔫猎人${tarName}被狼王带走，可开枪`)
  }
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
  if (isWolfRole(t.role)) {
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

export function finishVote(state: GameState, outName: string, idiotFlip: boolean): string | null {
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
  if (isIdiot && !outP.mark.idiotFlipped && idiotFlip) {
    outP.mark.idiotFlipped = true
    outP.alive = true
    pushGlobalLog(state, `🙊白痴${outName}被放逐，翻牌免死（失去投票权）`)
    pushFlow(state, "放逐", outName, "白痴翻牌")
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
  return null
}

export function wolfBaoZha(state: GameState, sel: string): string | null {
  if (!sel) return "请选择自爆的狼人"
  const p = state.players.find((x) => x.name === sel)
  if (!p) return "未找到该玩家"
  if (!p.alive) return "该玩家已出局"
  if (!isWolfRole(p.role)) return "只能选择狼人/白狼王自爆"
  killPlayer(state, sel, "selfBomb")
  state.skipVote = true
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
  killPlayer(state, sel, "selfBomb")
  killPlayer(state, tar, "other")
  state.skipVote = true
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
  const aliveWolfCount = state.players.filter((x) => x.alive && isWolfRole(x.role)).length
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
    // 狼人胜利：真狼 +3（狼狼恋无第三方，丘比特属好人不计狼胜分；人狼恋狼恋人属第三方不计狼胜）
    if (win === "wolf" && isWolfRole(p.role) && !isWGCamp) {
      s += 3
      detail.push("狼人胜利+3")
      if (p.alive) {
        if (aliveWolfCount >= 4) {
          s += 1
          detail.push("4狼存活+1")
        } else if (aliveWolfCount === 3) {
          s += 0.5
          detail.push("3狼存活+0.5")
        }
      }
    }
    // 好人胜利（狼全灭）：神职与平民同时拿基础分（人狼恋第三方成员除外）
    if ((win === "god" || win === "civil") && GOD_LIST.includes(p.role) && !isWGCamp) {
      s += 3
      detail.push("神职胜利+3")
    }
    // 使用角色系统判断平民角色
    const pRole = getRoleInstance(p.role)
    if ((win === "god" || win === "civil") && pRole && pRole.def.camp === "villager" && !isWGCamp) {
      s += 2
      detail.push("平民胜利+2")
    }
    if (win === "third" && isThirdMember(state, p)) {
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
function isThirdMember(state: GameState, p: Player): boolean {
  // 使用角色系统判断是否为丘比特
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

import { checkWin as checkWinRoleDriven } from "./win-checker"

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
    .filter((p) => (winnerIsWolf ? isWolfRole(p.role) : !isWolfRole(p.role)))
    .sort((a, b) => b.scoreRound - a.scoreRound)
  const losers = state.players
    .filter((p) => (winnerIsWolf ? !isWolfRole(p.role) : isWolfRole(p.role)))
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

export function finishGameAuto(state: GameState): string | null {
  if (state.finished) return "本局已结算，请勿重复结算"
  if (state.players.length === 0) return "还没有玩家，无法结算"
  if (!state.winCamp) {
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
  pushGlobalLog(state, `🏁一键完整结算完成：${WIN_TEXT[state.winCamp]}，各玩家本轮分已固化到总分`)
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
  state.players.forEach((p) => {
    txt += `玩家【${p.name}】身份：${p.role}，${p.alive ? "存活" : "出局"}，本轮分：${p.scoreRound.toFixed(1)}，总分：${p.scoreTotal.toFixed(1)}（${p.scoreDetail.join("；") || "无加分"}）\n`
  })
  txt += "\n====完整对局日志====\n"
  txt += state.globalLog
    .map((l, i) => `${i + 1}. ${decorateLog(state, cleanLogLine(l))}`)
    .join("\n")
  return txt
}

/** 各阵营角色分配摘要（用于结算展示） */
export function campBreakdown(state: GameState): string {
  const wolves = state.players.filter((p) => isWolfRole(p.role))
  const gods = state.players.filter((p) => GOD_LIST.includes(p.role))
  const civils = state.players.filter((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.camp === "villager"
  })
  const cupid = state.players.find((p) => {
    const role = getRoleInstance(p.role)
    return role && role.def.id === "丘比特"
  })
  const fmt = (arr: Player[]) => (arr.length ? arr.map((p) => `${p.no || 0}.${p.name}(${p.role})`).join("、") : "无")
  let txt = `🐺狼人阵营：${fmt(wolves)}\n🔮神职阵营：${fmt(gods)}\n👤平民阵营：${fmt(civils)}`
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