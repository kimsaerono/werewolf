import { computed, reactive, ref } from "vue"
import * as g from "@/game/logic"
import type { GameState, Player } from "@/game/logic"
import { roleAvatar } from "@/assets/roles"
import { speak } from "@/utils/speech"
import { syncGameToFeishu, simulateSyncNewPlayer } from "@/api/feishuSync"

const STORAGE_KEY = "werewolf_judge_v8"
const HISTORY_KEY = "werewolf_history"

export interface GameRecord {
  title: string
  time: string
  board: string
  winner: string
  reason: string
  judge: string
  judgeScore: number
    players: {
      no: number
      name: string
      role: string
      alive: boolean
      scoreRound: number
      scoreTotal: number
      star: string
      scoreDetail: string[]
    }[]
    log: string[]
    /** 情侣名单（用于第三方胜负判定） */
    lovers: string[]
    /** 是否已同步到飞书（防止重复累加） */
    synced: boolean
    /** 是否模拟对局（真实/模拟各自独立历史与编号） */
    sim: boolean
  }

function load(): GameState {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return g.normalizeState(JSON.parse(s))
  } catch {
    /* ignore */
  }
  return g.defaultState()
}

function loadHistory(): GameRecord[] {
  try {
    const s = localStorage.getItem(HISTORY_KEY)
    if (s) {
      return (JSON.parse(s) as GameRecord[]).map((r) => ({ ...r, synced: r.synced ?? false, sim: r.sim ?? false }))
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
  } catch {
    /* ignore */
  }
}

const state = reactive<GameState>(load())
const uiMode = ref<"night" | "day">("night")
const activeTab = ref("board")
const history = ref<GameRecord[]>(loadHistory())
const winNotice = ref<{ text: string; reason: string; camps: string } | null>(null)
const winNoticeOpen = computed({
  get: () => !!winNotice.value,
  set: (v: boolean) => {
    if (!v) winNotice.value = null
  },
})
/** 飞书同步状态："" 空闲 / "syncing" 同步中 / 成功文案 / 失败文案 */
const syncStatus = ref("")
/** 正在同步中的对局（自动/手动互斥，防止同一局被并发发两次导致重复累计） */
const syncingRefs = ref<Set<GameRecord>>(new Set())

const sessionNo = computed(() => modeHistory.value.length + 1)
const sessionTitle = computed(() => {
  const d = new Date()
  return `第${sessionNo.value}局 · ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

/** 当前模式的对局历史（真实/模拟各自独立） */
const modeHistory = computed(() => history.value.filter((h) => h.sim === state.simMode))

/** 记录日期键：YYYY/M/D（按天维度） */
function dayKey(time: string): string {
  const d = new Date(time)
  if (isNaN(d.getTime())) return ""
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
/** 日期文案：YYYY年M月D日 */
function dayLabelOf(key: string): string {
  const [y, m, d] = key.split("/")
  return `${y}年${Number(m) || ""}月${Number(d) || ""}日`
}
const todayKey = computed(() => dayKey(new Date().toLocaleString()))
/** 今天的对局（分数明细只展示当天，过期不展示；仅当前模式） */
const todayGames = computed(() => modeHistory.value.filter((h) => dayKey(h.time) === todayKey.value))
/** 当天对局编号文案：第1局/第2局/第3局 */
function dayGameLabel(idx: number): string {
  return `第${idx + 1}局`
}
/** 按天分组（天倒序，天内按局序）：历史对局展示用（仅当前模式） */
const historyByDay = computed(() => {
  const map = new Map<string, GameRecord[]>()
  for (const h of modeHistory.value) {
    const k = dayKey(h.time) || "未知日期"
    const arr = map.get(k) || []
    arr.push(h)
    map.set(k, arr)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "未知日期" ? 1 : b[0] === "未知日期" ? -1 : b[0].localeCompare(a[0])))
    .map(([key, games]) => ({ key, label: key === "未知日期" ? "未知日期" : dayLabelOf(key), games }))
})
/** 单局在当天内的 gameId（第X局 · 该局日期）：自动/手动/历史同步统一使用，保证幂等一致 */
function gameIdFor(rec: GameRecord): string {
  const k = dayKey(rec.time) || ""
  const group = k ? history.value.filter((h) => dayKey(h.time) === k && h.sim === rec.sim) : []
  const idx = group.indexOf(rec)
  const dayLabel = k ? dayLabelOf(k) : dayLabelOf(todayKey.value)
  const modeTag = rec.sim ? "模拟" : "真实"
  return `${modeTag}·${dayGameLabel(idx >= 0 ? idx : group.length)} · ${dayLabel}`
}
/** 是否正在同步中（UI 显示 loading 用） */
function isSyncing(rec: GameRecord): boolean {
  return syncingRefs.value.has(rec)
}
/** 单局完整复盘文本（复制本局详情 / 导出当天 用） */
function recordTxtOf(h: GameRecord): string {
  const logTxt = h.log
    .map((l, i) => `${i + 1}. ${g.decorateLog({ players: h.players } as never, g.cleanLogLine(l))}`)
    .join("\n")
  return (
    `====${gameIdFor(h)}====\n时间：${h.time}\n板子：${h.board}（${g.boardShortName(h.board)}）\n胜负：${h.winner}（${h.reason}）\n法官：${h.judge || "-"}（累计 ${h.judgeScore}）\n` +
    h.players
      .map((p) => `玩家 ${p.no}.${p.name} 身份：${p.role}，${p.alive ? "存活" : "出局"}，本轮分：${p.scoreRound.toFixed(1)}，总分：${p.scoreTotal.toFixed(1)}`)
      .join("\n") +
    `\n\n----对局日志----\n${logTxt}\n\n`
  )
}

/** 自动同步一局到飞书：按天编号写入对应场次 + 累计排名，成功标记已同步（不阻塞本地） */
async function autoSyncRecord(rec: GameRecord): Promise<void> {
  if (rec.synced || syncingRefs.value.has(rec)) return
  syncingRefs.value.add(rec)
  const gameId = gameIdFor(rec)
  syncStatus.value = "syncing"
  try {
    const err = await syncGameToFeishu(rec, gameId)
    if (err) {
      syncStatus.value = `⚠️ ${gameId} 同步失败：${err}`
    } else {
      rec.synced = true
      saveHistory()
      syncStatus.value = `✅ ${gameId} 已同步到飞书`
    }
  } finally {
    syncingRefs.value.delete(rec)
  }
  setTimeout(() => {
    syncStatus.value = ""
  }, 6000)
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/** 回退一步：操作前快照，只能回退一次 */
let lastSnapshot: string | null = null
let lastSnapFlowLen = 0
const canUndo = ref(false)
function snapshot(): void {
  lastSnapshot = JSON.stringify(state)
  lastSnapFlowLen = state.flow.length
  canUndo.value = true
}
/** 软步骤（闭眼/跳过等）：若上次快照后流程已推进，则保留那次快照，让回退回到真正的上一步 */
function softStep(): void {
  if (state.flow.length === lastSnapFlowLen) snapshot()
}
/** 阶段切换/开局时清空待回退，避免回退跨阶段 */
function clearPendingUndo(): void {
  lastSnapshot = null
  lastSnapFlowLen = state.flow.length
  canUndo.value = false
}
function undo(): boolean {
  if (!lastSnapshot) return false
  try {
    Object.assign(state, g.normalizeState(JSON.parse(lastSnapshot)))
    lastSnapshot = null
    canUndo.value = false
    persist()
    return true
  } catch {
    return false
  }
}

/** 每次操作后调用：重算分数 + 自动判胜负（判出则保存本局、锁定对局、弹窗） */
function refresh(): void {
  g.recalcScore(state)
  const r = g.checkWin(state)
  if (r.ended && r.text) {
    const isDraw = state.winCamp === "draw"
    g.finishGameAuto(state)
    state.recordText = g.buildAutoRecord(state, sessionTitle.value)
    history.value.push({
      title: sessionTitle.value,
      time: new Date().toLocaleString(),
      board: state.board,
      winner: r.text,
      reason: r.reason,
      judge: state.judge,
      judgeScore: g.judgeTotal(state),
      players: state.players.map((p: Player) => ({
        no: p.no,
        name: p.name,
        role: p.role,
        alive: p.alive,
        scoreRound: p.scoreRound,
        scoreTotal: p.scoreTotal,
        star: p.star,
        scoreDetail: [...p.scoreDetail],
      })),
      log: [...state.globalLog],
      lovers: [...state.lovers],
      synced: false,
      sim: state.simMode,
    })
    saveHistory()
    // 平局或模拟模式：不计积分、不同步飞书
    if (!isDraw && !state.simMode) {
      autoSyncRecord(history.value[history.value.length - 1])
    }
    const winText = state.winCamp === "wolf" ? "狼人胜利" : state.winCamp === "third" ? "第三方胜利" : state.winCamp === "draw" ? "平局" : "好人胜利"
    winNotice.value = { text: winText, reason: r.reason, camps: g.campBreakdown(state) }
    if (state.voiceEnabled) speak(`${winText}！${r.reason}`)
  }
  persist()
}

export function useGame() {
  const playerCount = computed(() => state.players.length)
  const maxNeed = computed(() => g.maxNeed(state))
  const aliveList = computed(() => state.players.filter((p) => p.alive))
  const judgeScore = computed(() => g.judgeTotal(state))

  const actions = {
    setBoard(b: string) {
      g.applyBoard(state, b)
      persist()
    },
    setWinMode(m: "edge" | "city") {
      state.winMode = m
      persist()
    },
    setSimMode(v: boolean) {
      state.simMode = v
      persist()
    },
    setModeChosen(v: boolean) {
      state.modeChosen = v
      if (v) activeTab.value = "board"
      persist()
    },
    setBoardRoles(roles: string[]): string | null {
      const err = g.setBoardRoles(state, roles)
      persist()
      return err
    },
    setVoice(id: string, text: string) {
      g.setVoice(state, id, text)
      persist()
    },
    setVoiceEnabled(enabled: boolean) {
      g.setVoiceEnabled(state, enabled)
      persist()
    },
    setJudge(name: string) {
      g.setJudge(state, name)
      persist()
    },
    clearJudge() {
      g.setJudge(state, "")
      persist()
    },
    confirmPlayers() {
      g.confirmPlayers(state)
      persist()
    },
    addPlayer(nick: string, no?: number): string | null {
      const err = g.addPlayer(state, nick, no)
      if (err === null) g.renumberPlayers(state)
      persist()
      return err
    },
    delPlayer(idx: number) {
      g.delPlayer(state, idx)
      g.renumberPlayers(state)
      persist()
    },
    movePlayer(from: number, to: number) {
      g.movePlayer(state, from, to)
      g.renumberPlayers(state)
      persist()
    },
    reorderPlayers(names: string[]) {
      g.reorderPlayers(state, names)
      persist()
    },
    clearPlayers() {
      g.clearAllPlayers(state)
      persist()
    },
    resetWholeGame(): boolean {
      clearPendingUndo()
      const s = g.resetWholeGame(state)
      Object.assign(state, s)
      refresh()
      return true
    },
    /** 开启下一局：保留法官/法官累计分/参与玩家，清角色与分数，直跳分配角色 */
    startNextGame() {
      clearPendingUndo()
      const board = state.board
      const boardRoles = state.boardRoles ? [...state.boardRoles] : null
      const judge = state.judge
      const judgeScores = { ...state.judgeScores }
      const winMode = state.winMode
      // 保留上一局参与玩家（号码、姓名），清空角色/状态/分数
      const players = state.players.map((p) => {
        const np = g.newPlayer(p.name)
        np.no = p.no
        return np
      })
      const s = g.defaultState()
      s.board = board
      s.boardRoles = boardRoles
      s.judge = judge
      s.judgeScores = judgeScores
      s.winMode = winMode
      s.players = players
      s.playersConfirmed = true
      Object.assign(state, s)
      activeTab.value = "game"
      persist()
    },
    importPlayers(names: string[]): number {
      let added = 0
      for (const n of names) {
        if (g.addPlayer(state, n) === null) added++
      }
      if (added > 0) g.renumberPlayers(state)
      persist()
      return added
    },
    /** 开局（idle 步骤）：清角色并重置对局状态，随后进入第 1 晚 */
    startGame() {
      clearPendingUndo()
      g.startNewGame(state)
      refresh()
    },
    confirmRole(name: string, role: string): string | null {
      const err = g.confirmRole(state, name, role)
      refresh()
      return err
    },
    confirmWolves(names: string[]): string | null {
      const err = g.confirmWolves(state, names)
      refresh()
      return err
    },
    autoFillCivilians(): number {
      const n = g.autoFillCivilians(state)
      refresh()
      return n
    },

    cupidConnect(names: string[]): string | null {
      const err = g.cupidConnect(state, names)
      refresh()
      return err
    },

    flowToggle() {
      if (state.phase === "night") {
        uiMode.value = uiMode.value === "night" ? "day" : "night"
      } else {
        clearPendingUndo()
        g.nextNight(state)
        uiMode.value = "night"
      }
      refresh()
    },
    setUiMode(m: "night" | "day") {
      uiMode.value = m
    },

    wolfKill(sel: string) {
      const err = g.wolfKill(state, sel)
      refresh()
      return err
    },
    prophetCheck(sel: string) {
      const r = g.prophetCheck(state, sel)
      refresh()
      return r
    },
    guardDo(sel: string, same: boolean) {
      const err = g.guardDo(state, sel, same)
      refresh()
      return err
    },
    witchSave() {
      const err = g.witchSave(state)
      refresh()
      return err
    },
    witchPoison(sel: string) {
      const err = g.witchPoison(state, sel)
      refresh()
      return err
    },
    hunterShoot(tar: string) {
      const err = g.hunterShootConfirm(state, tar)
      refresh()
      return err
    },
    hunterGiveUp() {
      const err = g.hunterGiveUpShot(state)
      refresh()
      return err
    },
    wolfKingShoot(tar: string) {
      const err = g.wolfKingShootConfirm(state, tar)
      refresh()
      return err
    },
    wolfKingGiveUp() {
      const err = g.wolfKingGiveUpShot(state)
      refresh()
      return err
    },
    knightDuel(tar: string) {
      const err = g.knightDuel(state, tar)
      refresh()
      return err
    },
    dawnSettle() {
      const err = g.resolveNightDeath(state)
      if (err === null) {
        clearPendingUndo()
        uiMode.value = "day"
      }
      refresh()
      return err
    },

    setJingHui(owner: string, hanTiao: boolean) {
      g.setJingHui(state, owner, hanTiao)
      refresh()
    },
    setJingHuiFlow(names: string[]) {
      g.setJingHuiFlow(state, names)
      refresh()
    },
    autoTransferJingHui(): string | null {
      const r = g.autoTransferJingHui(state)
      refresh()
      return r
    },
    loseJingHui() {
      g.loseJingHui(state)
      refresh()
    },
    finishVote(out: string, idiotFlip: boolean) {
      const err = g.finishVote(state, out, idiotFlip)
      refresh()
      return err
    },
    wolfBaoZha(sel: string) {
      const err = g.wolfBaoZha(state, sel)
      refresh()
      return err
    },
    wolfKingBaoZha(sel: string, tar: string) {
      const err = g.wolfKingBaoZha(state, sel, tar)
      refresh()
      return err
    },

    applyHonor(mvp: string, svp: string, beiguo: string) {
      g.applyHonor(state, mvp, svp, beiguo)
      refresh()
    },
    resetRoundScore() {
      g.resetRoundScore(state)
      refresh()
    },
    finishGameAuto(): string | null {
      const err = g.finishGameAuto(state)
      refresh()
      return err
    },

    buildRecord(): string {
      state.recordText = g.buildAutoRecord(state, sessionTitle.value)
      persist()
      return state.recordText
    },
    clearRecord() {
      state.recordText = ""
      persist()
    },
    /** 手动同步最近一局到飞书（返回错误信息或 null） */
    async syncLastGame(): Promise<string | null> {
      if (state.simMode) return "当前为模拟模式，不会同步到飞书"
      const rec = modeHistory.value[modeHistory.value.length - 1]
      if (!rec) return "暂无已结算的对局"
      syncStatus.value = "syncing"
      const err = await syncGameToFeishu(rec)
      syncStatus.value = err ? `⚠️ 同步失败：${err}` : "✅ 已同步最近一局到飞书"
      setTimeout(() => {
        syncStatus.value = ""
      }, 6000)
      return err
    },
    /** 批量同步今日对局到飞书：逐局写复盘+累加排名，成功标记已同步，失败停止可重试（与自动同步互斥） */
    async syncDayGames(): Promise<{ ok: number; failed: number; err: string | null }> {
      if (state.simMode) return { ok: 0, failed: 0, err: "当前为模拟模式，不会同步到飞书" }
      const list = todayGames.value.filter((h) => !h.synced && !syncingRefs.value.has(h))
      if (!list.length) return { ok: 0, failed: 0, err: "今天没有待同步的对局" }
      syncStatus.value = "syncing"
      let ok = 0
      let err: string | null = null
      for (const rec of list) {
        // 循环内逐个再判断：防止与并发中的自动同步撞车
        if (rec.synced || syncingRefs.value.has(rec)) continue
        syncingRefs.value.add(rec)
        const e = await syncGameToFeishu(rec, gameIdFor(rec))
        syncingRefs.value.delete(rec)
        if (e) {
          err = e
          break
        }
        ok++
        rec.synced = true
        saveHistory()
      }
      syncStatus.value = err ? `⚠️ 同步失败：${err}（已同步 ${ok} 局，剩余可重试）` : `✅ 已同步今日 ${ok} 局到飞书`
      setTimeout(() => {
        syncStatus.value = ""
      }, 6000)
      return { ok, failed: list.length - ok, err }
    },
    /** 单场同步（历史对局用）：校验未同步+互斥，成功标记已同步，可重试 */
    async syncRecord(rec: GameRecord): Promise<string | null> {
      if (state.simMode) return "当前为模拟模式，不会同步到飞书"
      if (rec.synced || syncingRefs.value.has(rec)) return "该局已同步或正在同步"
      syncingRefs.value.add(rec)
      syncStatus.value = "syncing"
      const gameId = gameIdFor(rec)
      try {
        const err = await syncGameToFeishu(rec, gameId)
        if (err) {
          syncStatus.value = `⚠️ ${gameId} 同步失败：${err}`
          return err
        }
        rec.synced = true
        saveHistory()
        syncStatus.value = `✅ ${gameId} 已同步到飞书`
        return null
      } finally {
        syncingRefs.value.delete(rec)
      }
    },
    /** 清空所有历史数据：保留板子/法官/胜负模式，清玩家/角色/积分/日志/历史/法官累计分（全新周期） */
    clearAllData() {
      const s = g.resetWholeGame(state)
      s.boardRoles = state.boardRoles
      s.judgeScores = {}
      Object.assign(state, s)
      history.value = []
      saveHistory()
      persist()
    },
    /** 测试同步：模拟新玩家（排名表/复盘表各加一行测试数据） */
    async testSync(): Promise<string | null> {
      if (state.simMode) return "当前为模拟模式，不会同步到飞书"
      syncStatus.value = "testing"
      const err = await simulateSyncNewPlayer()
      syncStatus.value = err ? `⚠️ 测试同步失败：${err}` : "✅ 已模拟新玩家同步（排名表积分列末尾新增一行）"
      setTimeout(() => {
        syncStatus.value = ""
      }, 6000)
      return err
    },
  }

  return {
    state,
    uiMode,
    activeTab,
    winNotice,
    winNoticeOpen,
    history,
    sessionNo,
    sessionTitle,
    todayGames,
    historyByDay,
    syncStatus,
    isSyncing,
    recordTxtOf,
    playerCount,
    maxNeed,
    aliveList,
    judgeScore,
    snapshot,
    softStep,
    undo,
    canUndo,
    actions,
    refs: {
      boardConfig: g.boardConfig,
      boardLabels: g.boardLabels,
      boardShortName: g.boardShortName,
      ALL_ROLE_OPT: g.ALL_ROLE_OPT,
      ROLE_EMOJI: g.ROLE_EMOJI,
      NO_CHECK: g.NO_CHECK,
      WIN_TEXT: g.WIN_TEXT,
      getBoardRoles: g.getBoardRoles,
      canAddRole: g.canAddRole,
      DEFAULT_VOICES: g.DEFAULT_VOICES,
      resolveVoice: g.resolveVoice,
      playerLabel: g.playerLabel,
      campBreakdown: g.campBreakdown,
      suggestHonor: g.suggestHonor,
      isWolfRole: g.isWolfRole,
      getChainType: g.getChainType,
      roleAvatar,
      decorateLog: g.decorateLog,
      cleanLogLine: g.cleanLogLine,
    },
  }
}
