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
export const ALL_ROLE_OPT = ["狼人", "白狼王", "狼王", "预言家", "女巫", "猎人", "守卫", "骑士", "白痴", "平民", "丘比特"]
/** 神职列表（丘比特独立特殊好人牌，不计神/民，不入此列） */
export const GOD_LIST = ["预言家", "女巫", "猎人", "白痴", "守卫", "骑士"]
/** 狼人阵营（含白狼王、狼王） */
export function isWolfRole(role: string): boolean {
  return role === "狼人" || role === "白狼王" || role === "狼王"
}
/** 唯一性角色：每个最多 1 个，不能重复加 */
export const UNIQUE_ROLES = ["预言家", "女巫", "猎人", "守卫", "白痴", "骑士", "白狼王", "狼王", "丘比特"]
/** 角色头像表情，一眼认出 */
export const ROLE_EMOJI: Record<string, string> = {
  狼人: "🐺",
  白狼王: "❄️🐺",
  狼王: "🔫🐺",
  预言家: "🔮",
  女巫: "🧙",
  猎人: "🔫",
  守卫: "🛡️",
  骑士: "⚔️",
  白痴: "🙊",
  平民: "👤",
  丘比特: "💘",
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

export interface Mark {
  prophetFirstDayWolf: boolean
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
  guardHit: boolean
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
}

export type WinCamp = "wolf" | "god" | "civil" | "third" | null
export type Phase = "idle" | "night" | "day"

export const DEFAULT_VOICES: Record<string, string> = {
  night_start: "天黑请闭眼。",
  cupid: "丘比特请睁眼！指认你选定的两位情侣，让大家感受爱情，看完赶紧闭眼。",
  cupid_close: "丘比特请闭眼。",
  wolf: "狼崽子睁眼！认认你的同伙，商量今晚刀哪个大冤种，密谋完赶紧闭眼装好人。",
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
  death: "号玩家出局，bye-bye，下局见！",
  vote: "现在是投票环节，请投出你怀疑的人。",
  explode: "狼人自爆：直接摆烂摊牌，不演了！白天结束全体闭眼入夜。",
  hunter: "枪哥，猎枪已上膛，逮个倒霉蛋过来陪葬！",
  hunter_poisoned: "毒药直接把枪腐蚀锈死啦，彻底哑火开不了！",
  idiot_flip: "显眼包亮身份赖场不走！以后没投票权，白天投不死，只能夜里搞他。",
  knight_duel_wolf: "骑士一剑戳中大灰狼！狼人直接寄，火速入夜！",
  knight_duel_good: "骑士看走眼翻车，自己白给，继续盘！",
  wwk_boom: "白狼王掀桌自爆！顺手薅走一个，直接入夜。",
  jinghui: "现在竞选警长。",
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
  jingHuiFlow: string[]
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
}

export function defaultMark(): Mark {
  return {
    prophetFirstDayWolf: false,
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
    guardHit: false,
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
    jingHuiFlow: [],
    wolfSelfKill: false,
    knightDuelUsed: false,
    winMode: "edge",
    uiDone: {},
    mvp: "",
    svp: "",
    beiguo: "",
    finished: false,
    lovers: [],
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
  st.players.forEach((p) => {
    p.mark = Object.assign(defaultMark(), p.mark || {})
    if (p.scoreRound === undefined) p.scoreRound = 0
    if (p.scoreTotal === undefined) p.scoreTotal = 0
    if (p.star === undefined) p.star = "-"
    if (!p.scoreDetail) p.scoreDetail = []
    if (p.no === undefined) p.no = 0
  })
  if (!st.judgeScores || typeof st.judgeScores !== "object") st.judgeScores = {}
  if (!st.uiDone || typeof st.uiDone !== "object") st.uiDone = {}
  // v9：角色改为夜晚睁眼确认。已在局中的旧存档视为已确认参与，保留访问权限
  if (st.players.length > 0 && (st.round > 0 || st.phase !== "idle")) st.playersConfirmed = true
  if (!Array.isArray(st.flow)) st.flow = []
  if (!Array.isArray(st.jingHuiFlow)) st.jingHuiFlow = []
  if (!Array.isArray(st.lovers)) st.lovers = []
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

/** 当前板子的角色列表：优先使用自定义 boardRoles，否则用默认配置 */
export function getBoardRoles(state: GameState): string[] {
  return state.boardRoles ?? boardConfig[state.board]
}

/** 编辑板子角色组合；返回错误或 null */
export function setBoardRoles(state: GameState, roles: string[]): string | null {
  const list = roles.filter(Boolean)
  if (list.length < 2) return "板子至少需要 2 个角色"
  if (!list.includes("狼人")) return "板子至少需要 1 个狼人"
  if (!list.some((r) => r !== "狼人")) return "板子至少需要 1 个好人"
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
  const nonCivil = Object.keys(quota).filter((r) => r !== "平民")
  const allDone = nonCivil.every((r) => state.players.filter((p) => p.role === r).length === quota[r])
  if (!allDone) return 0
  const civilQuota = quota["平民"] || 0
  const civilNow = state.players.filter((p) => p.role === "平民").length
  if (civilNow >= civilQuota) return 0
  let added = 0
  for (const p of state.players) {
    if (civilNow + added >= civilQuota) break
    if (p.role) continue
    p.role = "平民"
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
  const need = roleQuota(state)["狼人"] || 0
  const now = state.players.filter((p) => p.role === "狼人").length
  const unassigned = [...new Set(names)].filter(
    (n) => n && !state.players.find((p) => p.name === n)?.role,
  )
  if (now + unassigned.length > need) {
    return `狼人已确认 ${now} 个，本板子需要 ${need} 个，最多还能确认 ${need - now} 个`
  }
  for (const n of unassigned) confirmRole(state, n, "狼人")
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

/** 丘比特首夜连人：连接两名玩家为情侣（顺序无关，不能连自己） */
export function cupidConnect(state: GameState, names: string[]): string | null {
  const cupid = state.players.find((p) => p.role === "丘比特")
  if (!cupid) return "本局没有丘比特"
  const list = [...new Set(names.filter(Boolean))]
  if (list.length !== 2) return "请选择两位玩家作为情侣"
  if (list.includes(cupid.name)) return "丘比特不能连自己"
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
      killed.push(partnerName)
      pushGlobalLog(state, `💔${partnerName}因情侣殉情出局`)
      pushNightLog(state, `💔${partnerName}殉情出局`)
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
  const judge = state.judge
  const judgeScores = state.judgeScores
  const winMode = state.winMode
  const s = defaultState()
  s.board = board
  s.judge = judge
  s.judgeScores = judgeScores
  s.winMode = winMode
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
  // 预言家出局后仅流程性验人，不产生技能分
  if (state.round === 1 && isWolf) {
    const prop = state.players.find((p) => p.role === "预言家")
    if (prop && prop.alive) prop.mark.prophetFirstDayWolf = true
  }
  return { name: sel, isWolf }
}

export function prophetNoCheck(state: GameState): string | null {
  const prop = state.players.find((p) => p.role === "预言家")
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
  if (state.guardLastTarget && sel === state.guardLastTarget) {
    return `守卫不能连续两晚守同一人（${sel}上晚已被守）`
  }
  state.nightGuardTarget = sel
  state.nightSameSaveKill = flagSame
  state.nightSteps.guard = true
  const guard = state.players.find((p) => p.role === "守卫")
  if (!guard) return "本局没有守卫"
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
  const witch = state.players.find((p) => p.role === "女巫")
  if (!witch) return "本局没有女巫"
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
  const witch = state.players.find((p) => p.role === "女巫")
  if (!witch) return "本局没有女巫"
  const tar = state.players.find((x) => x.name === sel)
  state.witchPoisonUsed = true
  state.nightUsedDrug = "poison"
  state.nightWitchPoison = sel
  state.nightSteps.witch = true
  if (tar && isWolfRole(tar.role)) witch.mark.witchPoWolf = true
  else if (tar) witch.mark.witchPoGood = true
  pushNightLog(state, `🧪女巫撒毒${sel}`)
  pushGlobalLog(state, `🧪女巫毒药毒杀：${sel}`)
  pushFlow(state, "女巫毒药", sel)
  return null
}

export function hunterShootConfirm(state: GameState, tarName: string): string | null {
  const hunter = state.players.find((p) => p.role === "猎人")
  if (!hunter) return "本局没有猎人"
  if (!state.hunterShotPending) return "当前没有开枪时机（需猎人被刀或被放逐后才能开枪）"
  if (hunter.alive) return "猎人尚存活，未出局不能开枪！"
  if (hunter.mark.hunterIsPoisoned) return "猎人被毒，无法开枪！"
  if (!tarName) return "请选择被带走目标"
  const target = state.players.find((p) => p.name === tarName)
  if (!target) return "未找到目标玩家"
  target.alive = false
  if (isWolfRole(target.role)) hunter.mark.hunterKillWolf = true
  else hunter.mark.hunterKillGood = true
  state.hunterShotPending = false
  state.hunterShotDone = true
  applyLoverDeaths(state)
  pushNightLog(state, `🔫猎人${hunter.name}开枪带走${tarName}`)
  pushGlobalLog(state, `🔫猎人${hunter.name}开枪带走：${tarName}`)
  pushFlow(state, "猎人开枪", tarName)
  return null
}

export function hunterGiveUpShot(state: GameState): string | null {
  const hunter = state.players.find((p) => p.role === "猎人")
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
  const wk = state.players.find((p) => p.role === "狼王")
  if (!wk) return "本局没有狼王"
  if (!state.wolfKingShotPending) return "当前没有开枪时机（需狼王被刀或被放逐后才能开枪）"
  if (wk.alive) return "狼王尚存活，未出局不能开枪！"
  if (wk.mark.wolfKingIsPoisoned) return "狼王被毒，无法开枪！"
  if (!tarName) return "请选择被带走目标"
  const target = state.players.find((p) => p.name === tarName)
  if (!target) return "未找到目标玩家"
  target.alive = false
  if (isWolfRole(target.role)) wk.mark.wolfKingShotWolf = true
  else wk.mark.wolfKingShotGood = true
  state.wolfKingShotPending = false
  state.wolfKingShotDone = true
  applyLoverDeaths(state)
  pushNightLog(state, `🔫狼王${wk.name}开枪带走${tarName}`)
  pushGlobalLog(state, `🔫狼王${wk.name}开枪带走：${tarName}`)
  pushFlow(state, "狼王开枪", tarName)
  return null
}

export function wolfKingGiveUpShot(state: GameState): string | null {
  const wk = state.players.find((p) => p.role === "狼王")
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
  const knight = state.players.find((p) => p.role === "骑士")
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
    t.alive = false
    knight.mark.hunterKillWolf = true
    applyLoverDeaths(state)
    pushGlobalLog(state, `⚔️骑士${knight.name}决斗戳中狼人${tar}，狼人出局`)
    pushNightLog(state, `⚔️骑士决斗：${tar}是狼，被戳出局`)
    pushFlow(state, "骑士决斗", tar, "戳中狼")
  } else {
    knight.alive = false
    knight.mark.hunterKillGood = true
    applyLoverDeaths(state)
    pushGlobalLog(state, `⚔️骑士${knight.name}决斗戳错好人${tar}，骑士自己出局`)
    pushNightLog(state, `⚔️骑士决斗戳错，骑士出局`)
    pushFlow(state, "骑士决斗", tar, "戳错")
  }
  return null
}

export function setJingHui(state: GameState, owner: string, isWolfHanTiao: boolean): void {
  const prev = state.jingHui
  state.jingHui = owner
  const ow = owner ? state.players.find((p) => p.name === owner) : null
  // 自动判定悍跳：持有者为狼人阵营即记为悍跳
  const hanTiao = isWolfHanTiao || (!!ow && isWolfRole(ow.role))
  if (ow && hanTiao && isWolfRole(ow.role)) ow.mark.wolfHanTiaoJinghui = true
  const prevP = prev ? state.players.find((p) => p.name === prev) : null
  if (prev && prev !== owner && prevP && !prevP.alive) {
    pushGlobalLog(state, `📢警长${prev}已死亡，警徽移交：${owner || "无警徽"}`)
  } else {
    pushGlobalLog(state, `📢警徽持有者：${owner || "无"}${hanTiao ? "（狼人悍跳拿到警徽）" : ""}`)
  }
  pushFlow(state, "警徽", owner, hanTiao ? "悍跳" : "")
}

/** 设置警徽流（最多 2 人，出局后按顺序移交） */
export function setJingHuiFlow(state: GameState, names: string[]): void {
  state.jingHuiFlow = names.filter(Boolean).slice(0, 2)
  if (state.jingHuiFlow.length) {
    pushGlobalLog(state, `👑警长${state.jingHui || ""}的警徽流：${state.jingHuiFlow.join(" → ")}`)
  }
}

/** 警长出局：按警徽流自动移交，无人可接则警徽流失 */
export function autoTransferJingHui(state: GameState): string | null {
  if (!state.jingHui) return null
  const holder = state.players.find((p) => p.name === state.jingHui)
  if (!holder || holder.alive) return null
  const prev = state.jingHui
  const next = state.jingHuiFlow.find((n) => {
    const p = state.players.find((x) => x.name === n)
    return !!p && p.alive
  })
  if (next) {
    state.jingHui = next
    pushGlobalLog(state, `📢警长${prev}出局，按警徽流移交：${next}`)
    pushFlow(state, "警徽移交", next, "按警徽流")
    return next
  }
  state.jingHui = ""
  pushGlobalLog(state, `📢警长${prev}出局，警徽流无人可接，警徽流失`)
  pushFlow(state, "警徽流失", prev)
  return null
}

/** 警长出局：警徽直接作废（流失） */
export function loseJingHui(state: GameState): void {
  const prev = state.jingHui
  if (!prev) return
  state.jingHui = ""
  pushGlobalLog(state, `📢警长${prev}出局，警徽流失`)
  pushFlow(state, "警徽流失", prev)
}

export function finishVote(state: GameState, outName: string, idiotFlip: boolean): string | null {
  if (state.skipVote) return "本日已因狼人自爆跳过投票，请进入夜晚开始新的一轮"
  if (!outName) return "请选择放逐出局对象"
  const outP = state.players.find((p) => p.name === outName)
  if (!outP) return "未找到该玩家"
  if (!outP.alive) return `${outName}已出局，无需放逐`
  if (outP.role === "白痴" && !outP.mark.idiotFlipped && idiotFlip) {
    outP.mark.idiotFlipped = true
    outP.alive = true
    pushGlobalLog(state, `🙊白痴${outName}被放逐，翻牌免死（失去投票权）`)
    pushFlow(state, "放逐", outName, "白痴翻牌")
  } else {
    outP.alive = false
    applyLoverDeaths(state)
    pushGlobalLog(state, `⚖️投票放逐出局：${outName}`)
    pushFlow(state, "放逐", outName)
    if (outP.role === "猎人" && !outP.mark.hunterIsPoisoned) {
      state.hunterShotPending = true
      pushGlobalLog(state, `🔫猎人${outName}被放逐，可开枪（到夜间操作处理）`)
    }
    if (outP.role === "狼王" && !outP.mark.wolfKingIsPoisoned) {
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
  p.alive = false
  state.skipVote = true
  applyLoverDeaths(state)
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
  if (p.role !== "白狼王") return "只能选择白狼王自爆带人"
  const t = state.players.find((x) => x.name === tar)
  if (!t) return "未找到目标玩家"
  if (!t.alive) return "目标已出局"
  if (t.name === p.name) return "不能带走自己"
  p.alive = false
  t.alive = false
  state.skipVote = true
  applyLoverDeaths(state)
  if (t.role === "猎人" && !t.mark.hunterIsPoisoned) {
    state.hunterShotPending = true
    pushGlobalLog(state, `🔫猎人${tar}被白狼王带走，可开枪`)
  }
  if (t.role === "狼王" && !t.mark.wolfKingIsPoisoned) {
    state.wolfKingShotPending = true
    pushGlobalLog(state, `🔫狼王${tar}被白狼王带走，可开枪`)
  }
  pushGlobalLog(state, `💥白狼王${sel}自爆，带走${tar}，本日跳过投票`)
  pushFlow(state, "白狼王自爆", tar)
  return null
}

/** 天亮结算：把夜间操作结算成死亡，返回死亡名单 */
export function resolveNightDeath(state: GameState): string | null {
  if (state.phase !== "night") return "当前不是夜晚，无法天亮结算"
  const aliveWolfExists = state.players.some((p) => p.alive && isWolfRole(p.role))
  if (aliveWolfExists && !state.nightSteps.wolf) {
    return "狼人刀人步骤未完成，请先确认狼人刀人"
  }
  const wolfKillTarget = state.nightWolfKill
  const guardTarget = state.nightGuardTarget
  const poisonTarget = state.nightWitchPoison
  const witchSavedTarget = state.nightUsedDrug === "save" && state.witchSaveUsed ? state.nightWitchSave : ""
  // 自动判定同守同救：守卫与女巫同时救了被刀者 → 双双无效，被刀者仍死
  const guardSavesKill = !!wolfKillTarget && wolfKillTarget === guardTarget
  const witchSavedKill = !!wolfKillTarget && witchSavedTarget === wolfKillTarget
  const sameSaveKill = (guardSavesKill && witchSavedKill) || state.nightSameSaveKill

  const deathList: string[] = []
  if (sameSaveKill && wolfKillTarget) {
    const guard = state.players.find((p) => p.role === "守卫")
    if (guard) guard.mark.guardSameSaveKill = true
    deathList.push(wolfKillTarget)
  } else if (wolfKillTarget && wolfKillTarget === guardTarget) {
    const guard = state.players.find((p) => p.role === "守卫")
    if (guard) guard.mark.guardHit = true
  } else if (wolfKillTarget && wolfKillTarget !== witchSavedTarget) {
    deathList.push(wolfKillTarget)
  }
  if (poisonTarget) deathList.push(poisonTarget)

  ;[...new Set(deathList)].forEach((name) => {
    const p = state.players.find((x) => x.name === name)
    if (p && p.alive) {
      p.alive = false
      if (p.role === "猎人" && poisonTarget === name) {
        p.mark.hunterIsPoisoned = true
        pushNightLog(state, `⚠️猎人${name}被毒，本出局无法开枪`)
      }
      if (p.role === "猎人" && poisonTarget !== name) {
        state.hunterShotPending = true
        pushNightLog(state, `🔫猎人${name}被刀，可开枪`)
      }
      if (p.role === "狼王" && poisonTarget === name) {
        p.mark.wolfKingIsPoisoned = true
        pushNightLog(state, `⚠️狼王${name}被毒，本出局无法开枪`)
      }
      if (p.role === "狼王" && poisonTarget !== name) {
        state.wolfKingShotPending = true
        pushNightLog(state, `🔫狼王${name}被刀，可开枪`)
      }
    }
  })

  // 殉情：情侣一方出局则另一方立刻同死（不开枪），并入天亮死亡名单
  deathList.push(...applyLoverDeaths(state))

  state.guardLastTarget = state.nightGuardTarget
  state.skipVote = false
  state.phase = "day"
  state.uiDone = {}

  if (deathList.length === 0) {
    pushGlobalLog(state, `☀️天亮，平安夜`)
    pushNightLog(state, `☀️天亮，平安夜`)
    pushFlow(state, "天亮", "", "平安夜")
  } else {
    const deaths = [...new Set(deathList)].join("、")
    pushGlobalLog(state, `☀️天亮，昨夜死亡：${deaths}`)
    pushNightLog(state, `☀️天亮，昨夜死亡：${deaths}`)
    pushFlow(state, "天亮", deaths)
  }
  return null
}

// ===================== 实时算分 =====================

export function recalcScore(state: GameState): void {
  const win = state.winCamp
  const aliveWolfCount = state.players.filter((x) => x.alive && isWolfRole(x.role)).length
  state.players.forEach((p) => {
    const m = p.mark
    const detail: string[] = []
    let s = 0
    if (p.role === "预言家") {
      if (state.jingHui === p.name) {
        s += 0.5
        detail.push("拿警徽+0.5")
      }
      if (m.prophetFirstDayWolf) {
        s += 0.5
        detail.push("首夜验狼+0.5")
      }
      const nc = m.prophetNoCheckCount || 0
      if (nc > 0) {
        s -= 0.5 * nc
        detail.push(`未验人${nc}晚-${(0.5 * nc).toFixed(1)}`)
      }
    }
    if (p.role === "女巫") {
      if (m.witchPoWolf) {
        s += 1
        detail.push("毒狼+1")
      }
      if (m.witchPoGood) {
        s -= 1
        detail.push("毒好人-1")
      }
      if (m.witchSaveGood) {
        s += 0.5
        detail.push("救对好人+0.5")
      }
    }
    if (p.role === "猎人") {
      if (m.hunterKillWolf) {
        s += 1
        detail.push("带狼+1")
      }
      if (m.hunterKillGood) {
        s -= 1
        detail.push("带好人-1")
      }
    }
    if (p.role === "骑士") {
      if (m.hunterKillWolf) {
        s += 1
        detail.push("决斗戳狼+1")
      }
      if (m.hunterKillGood) {
        s -= 1
        detail.push("决斗戳错-1")
      }
    }
    if (p.role === "狼王") {
      if (m.wolfKingShotGood) {
        s += 1
        detail.push("枪带好人+1")
      }
      if (m.wolfKingShotWolf) {
        s -= 1
        detail.push("枪带狼人-1")
      }
    }
    if (p.role === "守卫") {
      if (m.guardHit) {
        s += 0.5
        detail.push("守中+0.5")
      }
      if (m.guardSameSaveKill) {
        s -= 0.5
        detail.push("同守同救-0.5")
      }
    }
    if (isWolfRole(p.role)) {
      if (m.wolfHanTiaoJinghui) {
        s += 0.5
        detail.push("悍跳拿警徽+0.5")
      }
      if (m.wolfSelfKillCheat) {
        s += 0.5
        detail.push("自刀骗解药+0.5")
      }
    }
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
    if (win === "wolf" && isWolfRole(p.role)) {
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
    // 好人胜利（狼全灭）：神职与平民同时拿基础分
    if ((win === "god" || win === "civil") && GOD_LIST.includes(p.role)) {
      s += 3
      detail.push("神职胜利+3")
    }
    if ((win === "god" || win === "civil") && p.role === "平民") {
      s += 2
      detail.push("平民胜利+2")
    }
    if (win === "third" && (p.role === "丘比特" || isLover(state, p.name))) {
      s += 3
      detail.push("第三方胜利+3")
    }
    if ((win === "god" || win === "civil") && p.role === "丘比特") {
      s += 3
      detail.push("好人胜利·丘比特+3")
    }
    p.scoreRound = Math.round(s * 10) / 10
    p.scoreDetail = detail
  })
}

export const WIN_TEXT: Record<"wolf" | "god" | "civil" | "third", string> = {
  wolf: "狼人胜利",
  god: "神职胜利",
  civil: "平民胜利",
  third: "第三方胜利",
}

/** 第三方成员：丘比特 + 两位恋人（人狼恋时三人一体） */
function isThirdMember(state: GameState, p: Player): boolean {
  return p.role === "丘比特" || isLover(state, p.name)
}

/** 自动判定胜负；返回是否"本次刚判出胜负"、胜负文案及原因（用于弹窗） */
export function checkWin(state: GameState): { ended: boolean; text: string; reason: string } {
  const aliveWolf = state.players.filter((p) => p.alive && isWolfRole(p.role))
  const aliveGod = state.players.filter(
    (p) => p.alive && GOD_LIST.includes(p.role) && !(p.role === "白痴" && p.mark.idiotFlipped),
  )
  const aliveCivil = state.players.filter((p) => p.alive && p.role === "平民")
  const allAssigned = state.players.length > 0 && state.players.every((p) => p.role)
  const started = allAssigned && (state.phase !== "idle" || state.round > 0)
  // 人狼恋第三方：情侣仍存活（殉情保证两人同生共死）
  const chain = getChainType(state)
  const loversBothAlive = state.lovers.length === 2 && state.lovers.every((n) => state.players.find((p) => p.name === n)?.alive)
  const thirdActive = started && chain === "WG" && loversBothAlive
  let wc: WinCamp = null
  if (started) {
    if (thirdActive) {
      // ① 第三方胜：存活玩家全部是第三方成员（丘比特/恋人）——丘比特已死时只剩情侣两人也算
      const aliveAll = state.players.filter((p) => p.alive)
      if (aliveAll.length > 0 && aliveAll.every((p) => isThirdMember(state, p))) {
        wc = "third"
      }
      // 否则：情侣未死前，好/狼一律不判胜（第三方保留）
    } else if (aliveWolf.length > 0) {
      // 屠边：神或民任一全灭；屠城：神与民全灭
      const goodGone = state.winMode === "city" ? aliveGod.length === 0 && aliveCivil.length === 0 : aliveGod.length === 0 || aliveCivil.length === 0
      if (goodGone) wc = "wolf"
    } else {
      wc = aliveGod.length > 0 ? "god" : "civil"
    }
  }
  let reason = ""
  if (wc === "third") {
    reason = "场上只剩丘比特与人狼情侣，第三方存活到最后"
  } else if (wc === "wolf") {
    const goneGod = aliveGod.length === 0
    const goneCivil = aliveCivil.length === 0
    reason =
      thirdActive
        ? "狼人屠边且第三方情侣已出局"
        : goneGod && goneCivil
          ? "狼人存活，神职与平民全灭"
          : state.winMode === "city"
            ? "屠城：狼人存活，神职与平民尚未全灭"
            : goneGod
              ? "屠边：神职全灭"
              : "屠边：平民全灭"
  } else if (wc === "god") {
    reason = thirdActive ? "所有狼人与第三方均已出局，好人胜利" : "所有狼人已出局，好人胜利"
  } else if (wc === "civil") {
    reason = thirdActive ? "所有狼人与第三方均已出局，好人胜利" : "所有狼人已出局，好人胜利"
  }
  const prev = state.winCamp
  state.winCamp = wc
  const ended = prev !== wc && wc !== null
  return { ended, text: ended ? WIN_TEXT[wc as "wolf" | "god" | "civil" | "third"] : "", reason }
}

// ===================== 荣誉 / 结算 / 导出 =====================

export function applyHonor(state: GameState, mvp: string, svp: string, beiguo: string): void {
  state.mvp = mvp
  state.svp = svp
  state.beiguo = beiguo
  pushGlobalLog(state, `🏆荣誉：MVP=${mvp || "-"},SVP=${svp || "-"},背锅侠=${beiguo || "-"}`)
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
  const civils = state.players.filter((p) => p.role === "平民")
  const cupid = state.players.find((p) => p.role === "丘比特")
  const fmt = (arr: Player[]) => (arr.length ? arr.map((p) => `${p.no || 0}.${p.name}(${p.role})`).join("、") : "无")
  let txt = `🐺狼人阵营：${fmt(wolves)}\n🔮神职阵营：${fmt(gods)}\n👤平民阵营：${fmt(civils)}`
  if (cupid || state.lovers.length) {
    const thirdMembers = state.players.filter((p) => p.role === "丘比特" || isLover(state, p.name))
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
