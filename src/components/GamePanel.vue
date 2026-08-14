<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { App as AntApp } from "ant-design-vue"
import { speak, stopSpeak, speakQueue, getVoiceStyle, setVoiceStyle, voiceStyleOptions } from "@/utils/speech"
import { playSfx, type SfxName } from "@/utils/sfx"
import { startCountdown, stopCountdown } from "@/utils/countdown"
import SeatBoard from "@/components/SeatBoard.vue"
import RoleHelp from "@/components/RoleHelp.vue"
import type { Game } from "@/types"

const { message, modal } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, activeTab, aliveList, actions, refs, sessionNo, snapshot, softStep, undo, canUndo, syncStatus } = props.game

// 结算后飞书自动同步失败 → 轻提示（成功静默）
watch(syncStatus, (s) => {
  if (s && s.startsWith("⚠️")) message.error(s, 6)
})

// ===== 通用单选玩家弹窗 =====
const picker = ref<{
  title: string
  options: { value: string; label: string }[]
  onConfirm: (v: string) => void
} | null>(null)
const pickerValue = ref("")
function openPicker(
  title: string,
  options: { value: string; label: string }[],
  onConfirm: (v: string) => void,
) {
  picker.value = { title, options, onConfirm }
  pickerValue.value = ""
}
function confirmPicker() {
  if (!picker.value || !pickerValue.value) return
  const cb = picker.value.onConfirm
  const v = pickerValue.value
  picker.value = null
  pickerValue.value = ""
  cb(v)
}

// ===== 各步选择状态 =====
const checkResult = ref("")
const jingHuiOwner = ref("")
const flow1Sel = ref("")
const flow2Sel = ref("")
const sheriffDeathModal = ref(false)
const deadSheriff = ref("")
const idiotFlip = ref(false)
const lastDawnDeaths = ref<string[]>([])

const jinghuiModal = ref(false)
const voiceDrawer = ref(false)
const witchModal = ref<"save" | "poison" | null>(null)
const wolfConfirmOpen = ref(false)
const wolfSel = ref<string[]>([])
const cupidConnectOpen = ref(false)
const cupidSel = ref<string[]>([])

// ===== 遗言计时（白天出局玩家） =====
const LAST_WORDS_SECONDS = 35
const lastWordsShow = ref(false)
const lastWordsRunning = ref(false)
const lastWordsLeft = ref(0)
const lastWordsName = ref("")
function startLastWords() {
  lastWordsRunning.value = true
  lastBeep = 99
  startCountdown(
    LAST_WORDS_SECONDS,
    (s) => {
      lastWordsLeft.value = s
      if (s >= 1 && s <= 7 && lastBeep !== s) {
        lastBeep = s
        playSfx("beep")
      }
      if (s <= 0) {
        playSfx("ding")
        message.warning("遗言时间到！")
      }
    },
    () => {
      lastWordsRunning.value = false
      lastWordsLeft.value = 0
    },
  )
  playSfx("beep")
}
function stopLastWords() {
  stopCountdown()
  lastWordsRunning.value = false
  lastWordsLeft.value = 0
}
/** 遗言计时重置：从头重新计时 */
function resetLastWords() {
  if (!lastWordsRunning.value) return startLastWords()
  stopCountdown()
  startLastWords()
}

// ===== 发言倒计时（白天，全局唯一计时器） =====
const speechRunning = ref(false)
const speechLeft = ref(0)
const randNo = ref<number | null>(null)
let lastBeep = 99
const SPEECH_SECONDS = computed(() => (state.jingHui ? 45 : 35))
const speechOrderHint = computed(() => {
  if (state.jingHui) return `警长 ${jingHuiLabel.value} 左右侧发言`
  return "无警长：死左 / 死右发言（可抽随机数）"
})
function startSpeech() {
  speechRunning.value = true
  lastBeep = 99
  startCountdown(
    SPEECH_SECONDS.value,
    (s) => {
      speechLeft.value = s
      if (s >= 1 && s <= 7 && lastBeep !== s) {
        lastBeep = s
        playSfx("beep")
      }
      if (s <= 0) {
        playSfx("ding")
        message.warning("发言时间到！")
      }
    },
    () => {
      speechRunning.value = false
      speechLeft.value = 0
    },
  )
  playSfx("beep")
}
function stopSpeech() {
  stopCountdown()
  speechRunning.value = false
  speechLeft.value = 0
}
function rollRand() {
  // 无警长时按当前参与人数抽随机数
  const n = aliveCount.value || state.players.length || 1
  randNo.value = Math.floor(Math.random() * n) + 1
}
/** 抽中的号对应的存活玩家（用于展示名字） */
const randPlayer = computed(() => {
  if (randNo.value == null) return null
  return state.players.find((p) => p.alive && p.no === randNo.value) || null
})
function finishSpeech() {
  stopSpeech()
  markDoneStep("speech")
  message.success("发言结束，进入投票")
}

// ===== 回退一步 =====
function doUndo() {
  modal.confirm({
    title: "确认回退上一步？",
    content: "将撤销上一步操作，恢复玩家状态、日志与对局流程进度（只能回退一次）",
    okText: "确认回退",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      if (!undo()) return message.warning("暂无可回退的操作")
      // 回退后重置本地瞬时展示（步骤/进度由 state 自动恢复）
      stopSpeech()
      checkResult.value = ""
      lastDawnDeaths.value = []
      message.success("已回退上一步（含日志、玩家状态与当前进度）")
    },
  })
}

const hasRole = (r: string) => computed(() => state.players.some((p) => p.role === r))
const hasProphet = hasRole("预言家")
const hasWitch = hasRole("女巫")
const hasGuard = hasRole("守卫")
const hasHunter = hasRole("猎人")
const hasKnight = hasRole("骑士")
const hasIdiot = hasRole("白痴")
const hasWWK = hasRole("白狼王")
const hasCupid = hasRole("丘比特")
const hunterObj = computed(() => state.players.find((p) => p.role === "猎人"))
const guardObj = computed(() => state.players.find((p) => p.role === "守卫"))
const jingHuiObj = computed(() => state.players.find((p) => p.name === state.jingHui))
const jingHuiLabel = computed(() =>
  jingHuiObj.value ? refs.playerLabel(jingHuiObj.value) : state.jingHui,
)
const labelOf = (name: string) => {
  const p = state.players.find((x) => x.name === name)
  return p ? refs.playerLabel(p) : name
}
const hunterStatus = computed(() => {
  const h = hunterObj.value
  if (!h) return ""
  if (h.mark.hunterIsPoisoned) return "⛔ 被毒吞枪"
  if (state.hunterShotPending) return "🔴 可开枪"
  if (state.hunterShotDone) return "✅ 已开枪"
  if (!h.alive) return "❌ 已出局"
  return "🔫 正常可开枪"
})
const wolfKingObj = computed(() => state.players.find((p) => p.role === "狼王"))
const wolfKingStatus = computed(() => {
  const wk = wolfKingObj.value
  if (!wk) return ""
  if (wk.mark.wolfKingIsPoisoned) return "⛔ 被毒吞枪"
  if (state.wolfKingShotPending) return "🔴 可开枪"
  if (state.wolfKingShotDone) return "✅ 已开枪"
  if (!wk.alive) return "❌ 已出局"
  return "🔫 正常可开枪"
})
const aliveCount = computed(() => state.players.filter((p) => p.alive).length)
const phaseText = computed(() =>
  state.phase === "idle" ? "未开局" : state.phase === "night" ? "🌙夜晚" : "☀️白天",
)
/** 当前板子配置摘要：角色 × 数量（用于顶部展示） */
const boardSummary = computed(() => {
  const roles = refs.getBoardRoles(state)
  const counts: Record<string, number> = {}
  roles.forEach((r) => (counts[r] = (counts[r] || 0) + 1))
  return Object.entries(counts)
    .map(([role, n]) => `${refs.ROLE_EMOJI[role] || ""}${role}×${n}`)
    .join(" ")
})
const boardLabel = computed(() => refs.boardLabels[state.board] || state.board)

// ===== 对局流程进度 =====
const FLOW_EMOJI: Record<string, string> = {
  守卫守人: "🛡️",
  狼人刀人: "🌑",
  预言家验人: "🔮",
  女巫解药: "💚",
  女巫毒药: "☠️",
  天亮: "🌅",
  丘比特连人: "💘",
   猎人开枪: "🔫",
   猎人弃枪: "⏭️",
   狼王开枪: "🔫",
   狼王弃枪: "⏭️",
  骑士决斗: "⚔️",
  警徽: "📢",
  放逐: "🗳️",
  狼人自爆: "💥",
   白狼王自爆: "👑💥",
}
const flowGroups = computed(() => {
  const map: Record<number, typeof state.flow> = {}
  for (const f of state.flow) {
    if (!map[f.night]) map[f.night] = []
    map[f.night].push(f)
  }
  return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]))
})
/** 流程标签里的人名统一转成 号码(身份) 展示 */
function flowTargetLabel(target: string): string {
  const p = state.players.find((x) => x.name === target)
  return p ? refs.playerLabel(p) : target
}
function flowText(f: { label: string; target: string; detail: string }) {
  const base = `${FLOW_EMOJI[f.label] || "·"}${f.label}`
  if (f.label === "天亮") return base // 具体死亡情况由该晚标题后的情况标签展示
  const t = f.target ? flowTargetLabel(f.target) : ""
  return t ? `${base}(${t}${f.detail ? `·${f.detail}` : ""})` : f.target === "" && f.detail ? `${base}(${f.detail})` : base
}
function nightSituation(steps: { label: string; target: string; detail: string }[]): string {
  const dawn = steps.find((s) => s.label === "天亮")
  if (!dawn) return ""
  if (!dawn.target) return "平安夜"
  const labels = dawn.target.split("、").map((n) => flowTargetLabel(n)).join("、")
  return `昨夜：${labels} 出局`
}
/** 日志展示：去时间前缀 + 玩家名转 号码(身份) */
const displayLog = (l: string) => refs.decorateLog(state, refs.cleanLogLine(l))

/** 统一玩家下拉选项：号码（姓名 角色），警长加👑标识 */
const aliveOptions = computed(() =>
  aliveList.value.map((p) => ({
    value: p.name,
    label: (p.name === state.jingHui ? "👑 " : "") + refs.playerLabel(p),
  })),
)
const playerOptions = computed(() =>
  state.players.map((p) => ({
    value: p.name,
    label: (p.name === state.jingHui ? "👑 " : "") + refs.playerLabel(p),
  })),
)
const wolfAliveOptions = computed(() =>
  aliveList.value
    .filter((p) => refs.isWolfRole(p.role))
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)
/** 普通自爆：狼阵营（狼人/狼王）；白狼王走专属自爆带人 */
const wolfPlainOptions = computed(() =>
  aliveList.value
    .filter((p) => refs.isWolfRole(p.role) && p.role !== "白狼王")
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)
// ===== 首夜睁眼认人：板子角色配额与确认状态 =====
const boardRolesArr = computed(() => refs.getBoardRoles(state))
const wolfCampRoles = computed(() => boardRolesArr.value.filter((r) => refs.isWolfRole(r)))
const wolfCampStatus = computed(() => {
  const map: Record<string, { need: number; have: number }> = {}
  for (const r of wolfCampRoles.value) {
    if (!map[r]) map[r] = { need: 0, have: 0 }
    map[r].need++
  }
  for (const p of state.players) {
    if (p.role && refs.isWolfRole(p.role)) {
      if (!map[p.role]) map[p.role] = { need: 0, have: 0 }
      map[p.role].have++
    }
  }
  return map
})
const wolfAllConfirmed = computed(() =>
  Object.values(wolfCampStatus.value).every((s) => s.have >= s.need),
)
const wolfCampUnconfirmed = computed(() =>
  wolfCampRoles.value.filter((r) => (wolfCampStatus.value[r]?.have || 0) < (wolfCampStatus.value[r]?.need || 0)),
)
const wolfCampSingleUnconfirmed = computed(() => wolfCampUnconfirmed.value.filter((r) => r !== "狼人"))
const wolfNeed = computed(() => wolfCampStatus.value["狼人"]?.need || 0)
const wolfCount = computed(() => wolfCampStatus.value["狼人"]?.have || 0)
/** 未确认身份且存活的玩家（用于睁眼认人） */
const unassignedAliveOptions = computed(() =>
  aliveList.value
    .filter((p) => !p.role)
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)
/** 白狼王自爆带走目标：白狼王本人除外 */
const wwkObj = computed(() => state.players.find((p) => p.role === "白狼王"))
const wwkTarOptions = computed(() =>
  aliveList.value
    .filter((p) => p.name !== wwkObj.value?.name)
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)

// ===== 单步向导 =====

const STEP_META: Record<string, { label: string; emoji: string }> = {
  idle: { label: "开始游戏", emoji: "🚀" },
  cupid: { label: "丘比特连人", emoji: "💘" },
  guard: { label: "守卫守人", emoji: "🛡️" },
  wolf: { label: "狼人刀人", emoji: "🌑" },
  prophet: { label: "预言家验人", emoji: "🔮" },
  witch: { label: "女巫操作", emoji: "🧪" },
  knight: { label: "骑士睁眼", emoji: "⚔️" },
  knight_close: { label: "骑士闭眼", emoji: "⚔️" },
  hunterOpen: { label: "猎人睁眼", emoji: "🔫" },
  idiotOpen: { label: "白痴睁眼", emoji: "🙊" },
  dawn: { label: "天亮", emoji: "🌅" },
  hunter: { label: "猎人开枪", emoji: "🔫" },
  wolfkingShot: { label: "狼王开枪", emoji: "🔫" },
  jinghui: { label: "竞选警长", emoji: "📢" },
  prophetReport: { label: "报验人", emoji: "🔮" },
  speech: { label: "发言环节", emoji: "🗣️" },
  vote: { label: "放逐投票", emoji: "🗳️" },
  night: { label: "进入夜晚", emoji: "🌙" },
  end: { label: "本局结束", emoji: "🏁" },
}
const STEP_VOICE: Record<string, string> = {
  guard: "guard",
  wolf: "wolf",
  prophet: "prophet",
  witch: "witch",
  knight: "knight",
  cupid: "cupid",
  hunterOpen: "hunter_open",
  idiotOpen: "idiot_open",
  dawn: "dawn",
  hunter: "hunter",
  jinghui: "jinghui",
  vote: "vote",
}
/** 步骤完成后的闭眼语音 */
const STEP_CLOSE: Record<string, string> = {
  guard: "guard_close",
  wolf: "wolf_close",
  prophet: "prophet_close",
  witch: "witch_close",
  knight: "knight_close",
  cupid: "cupid_close",
  hunterOpen: "hunter_close",
  idiotOpen: "idiot_close",
}
const VOICE_LABEL: Record<string, string> = {
  night_start: "进入夜晚（天黑请闭眼）",
  cupid: "丘比特睁眼",
  cupid_close: "丘比特闭眼",
  wolf: "狼人睁眼",
  wolf_king_gesture: "狼王/白狼王举手示意",
  wolf_close: "狼人闭眼",
  prophet: "预言家睁眼",
  prophet_close: "预言家闭眼",
  guard: "守卫睁眼",
  guard_close: "守卫闭眼",
  witch: "女巫睁眼",
  witch_close: "女巫闭眼",
  knight: "骑士睁眼",
  knight_close: "骑士闭眼",
  dawn: "天亮",
  dawn_peace: "天亮（平安夜）",
  death: "出局播报",
  vote: "放逐投票",
  explode: "狼人自爆",
  wwk_boom: "白狼王自爆带人",
  hunter: "猎人开枪",
  hunter_poisoned: "猎人被毒",
  hunter_open: "猎人睁眼",
  hunter_close: "猎人闭眼",
  idiot_open: "白痴睁眼",
  idiot_close: "白痴闭眼",
  idiot_flip: "白痴翻牌",
  knight_duel_wolf: "骑士决斗戳狼",
  knight_duel_good: "骑士决斗戳错",
  jinghui: "警徽竞选",
}

const uiDone = computed(() => state.uiDone)
function markDone(key: string) {
  state.uiDone = { ...state.uiDone, [key]: true }
}
/** 软步骤（闭眼/跳过等无状态变更的操作）先快照再标记，保证可回退 */
function markDoneStep(key: string) {
  softStep()
  markDone(key)
}

const stepKeys = computed(() => {
  if (state.finished) return ["end"]
  if (state.phase === "idle") return ["idle"]
  if (state.phase === "night") {
    const ks: string[] = []
    const roles = refs.getBoardRoles(state)
    const wolfQuotaN = roles.filter((r) => refs.isWolfRole(r)).length
    const wolfDone = state.players.filter((p) => refs.isWolfRole(p.role)).length >= wolfQuotaN
    const aliveWolf = state.players.some((p) => p.alive && refs.isWolfRole(p.role))
    // 行动顺序：丘比特(仅首夜) → 守卫 → 狼人 → 女巫 → 预言家 → 白痴(仅首夜) → 骑士(仅首夜) → 猎人状态确认(每夜) → 竞选警长(首夜) → 天亮
    if (state.round <= 1 && roles.includes("丘比特") && !uiDone.value.cupid) ks.push("cupid")
    if (roles.includes("守卫") && (!guardObj.value || guardObj.value.alive) && !state.nightSteps.guard && !uiDone.value.guard) ks.push("guard")
    if (wolfQuotaN > 0 && (!wolfDone || aliveWolf) && !uiDone.value.wolf) ks.push("wolf")
    if (roles.includes("女巫") && !state.nightSteps.witch && !uiDone.value.witch) ks.push("witch")
    if (roles.includes("预言家") && !uiDone.value.prophet) ks.push("prophet")
    if (state.round <= 1 && roles.includes("白痴") && !uiDone.value.idiotOpen) ks.push("idiotOpen")
    if (state.round <= 1 && roles.includes("骑士") && !uiDone.value.knight) ks.push("knight")
    if (roles.includes("猎人") && !uiDone.value.hunterOpen && (!hunterObj.value || hunterObj.value.alive)) ks.push("hunterOpen")
    // 首夜所有角色睁眼后先竞选警长，再天亮公布死讯
    if (state.round <= 1 && !uiDone.value.jinghui) ks.push("jinghui")
    if (ks.length === 0) ks.push("dawn")
    return ks
  }
  if (state.skipVote) {
    // 自爆跳过投票：但若存在待开枪（如白狼王带走猎人/狼王），先处理枪再入夜
    if (state.wolfKingShotPending) return ["wolfkingShot"]
    if (state.hunterShotPending) return ["hunter"]
    return ["night"]
  }
  const ks: string[] = []
  const roles = refs.getBoardRoles(state)
  if (state.wolfKingShotPending) ks.push("wolfkingShot")
  if (state.hunterShotPending) ks.push("hunter")
  if (state.round <= 1 && roles.includes("预言家") && !uiDone.value.prophetReport) ks.push("prophetReport")
  if (!uiDone.value.speech) ks.push("speech")
  if (!uiDone.value.vote) ks.push("vote")
  ks.push("night")
  return ks
})

const currentStep = computed(() => {
  if (state.finished) return "end"
  return stepKeys.value[0] || "idle"
})

/** 只在「对局操作」tab 可见时自动播报；延迟足够长避免截断闭眼语音；出局播报期间抑制 */
let suppressStepVoiceUntil = 0
watch(
  currentStep,
  (key, old) => {
    if (!key || key === old) return
    if (activeTab.value !== "game") return
    if (Date.now() < suppressStepVoiceUntil) return
    const vid = STEP_VOICE[key]
    if (vid && state.voiceEnabled) {
      setTimeout(() => {
        if (currentStep.value === key && Date.now() >= suppressStepVoiceUntil)
          speak(refs.resolveVoice(state, vid))
        // 狼人睁眼：板子含狼王/白狼王 → 补一句举手示意
        if (key === "wolf") {
          const roles = refs.getBoardRoles(state)
          if (roles.includes("狼王") || roles.includes("白狼王")) {
            setTimeout(() => {
              if (currentStep.value === key && Date.now() >= suppressStepVoiceUntil)
                speak(refs.resolveVoice(state, "wolf_king_gesture"))
            }, 3200)
          }
        }
      }, 2200)
    }
  },
)
watch(
  () => state.phase,
  (ph) => {
    if (ph === "night") {
      lastDawnDeaths.value = []
      lastWordsShow.value = false
      lastWordsName.value = ""
    }
  },
)
// 步骤切换时清空弹窗选择（v28）
watch(currentStep, (key) => {
  pickerValue.value = ""
  if (key === "jinghui") {
    flow1Sel.value = state.jingHuiFlow[0] || ""
    flow2Sel.value = state.jingHuiFlow[1] || ""
  }
})

function playVoice(id: string) {
  if (state.voiceEnabled) speak(refs.resolveVoice(state, id))
}
function playStepVoice() {
  const vid = STEP_VOICE[currentStep.value]
  if (vid && state.voiceEnabled) speak(refs.resolveVoice(state, vid))
}

// ===== 各步骤操作 =====

function doWolfKill(v: string) {
  snapshot()
  const err = actions.wolfKill(v)
  if (err) return message.error(err)
  const victim = state.players.find((x) => x.name === v)
  effect("wolf", "death", victim ? `狼人刀：${refs.playerLabel(victim)}` : `狼人刀：${v}`)
}
function doWolfClose() {
  markDoneStep("wolf")
  playVoice("wolf_close")
}

// ===== 首夜睁眼认人：法官确认角色身份 =====
function doConfirmRole(role: string, v: string) {
  snapshot()
  const err = actions.confirmRole(v, role)
  if (err) return message.error(err)
  message.success(`已确认 ${v} 为${refs.ROLE_EMOJI[role] || ""}${role}`)
}
function openWolfConfirm() {
  wolfSel.value = state.players.filter((p) => p.role === "狼人").map((p) => p.name)
  wolfConfirmOpen.value = true
}
function confirmWolfSel() {
  if (wolfSel.value.length !== wolfNeed.value) {
    return message.error(`本板子需要确认 ${wolfNeed.value} 个狼人，当前勾选 ${wolfSel.value.length} 个`)
  }
  snapshot()
  const err = actions.confirmWolves(wolfSel.value)
  if (err) return message.error(err)
  wolfConfirmOpen.value = false
  message.success("狼人身份已确认")
}

// ===== 丘比特连人 =====
const cupidObj = computed(() => state.players.find((p) => p.role === "丘比特"))
const chainText = computed(() => {
  const c = refs.getChainType(state)
  if (c === "WG") return "人狼恋·第三方"
  if (c === "WW") return "狼狼恋"
  if (c === "GG") return "人人恋"
  return ""
})
const loversLabel = computed(() => state.lovers.map((n) => labelOf(n)).join(" ❤ ") || "")
function openCupidConnect() {
  cupidSel.value = state.lovers.filter((n) => n)
  cupidConnectOpen.value = true
}
function confirmCupidConnect() {
  if (cupidSel.value.length !== 2) {
    return message.error("请选择两位玩家作为情侣")
  }
  snapshot()
  const err = actions.cupidConnect(cupidSel.value)
  if (err) return message.error(err)
  cupidConnectOpen.value = false
  const c = refs.getChainType(state)
  const txt = c === "WG" ? "人狼恋 → 第三方阵营成立！" : c === "WW" ? "狼狼恋" : c === "GG" ? "人人恋" : "已连人（身份确认后判定链型）"
  message.success(`💘 ${state.lovers.join(" ❤ ")} 连为情侣（${txt}）`)
  effect("cupid", undefined, `情侣：${state.lovers.join(" ❤ ")}`)
  markDoneStep("cupid")
  playVoice("cupid_close")
}
function skipCupid() {
  confirmSkip("本轮不连人？", "丘比特本局不连情侣，确认后闭眼", () => {
    markDoneStep("cupid")
    playVoice("cupid_close")
  })
}
/** 情侣已连：法官确认完成本步 */
function finishCupidStep() {
  markDoneStep("cupid")
  playVoice("cupid_close")
}
/** 情侣解散判定（双方均已出局） */
const loversGone = computed(() => state.lovers.length === 2 && state.lovers.every((n) => !state.players.find((p) => p.name === n)?.alive))
const thirdActive = computed(() => refs.getChainType(state) === "WG" && !loversGone.value)
/** 第三方成员名单（丘比特 + 人狼恋人，用于座位牌紫色角标） */
const thirdMembersList = computed(() =>
  thirdActive.value
    ? state.players.filter((p) => p.role === "丘比特" || state.lovers.includes(p.name)).map((p) => p.name)
    : [],
)
/** 情侣标签 tooltip 说明 */
const loversTip = computed(() => {
  if (thirdActive.value) return "❤️ 第三方阵营：丘比特 + 人狼情侣三人一体，需双方阵营连同情侣一起清空才能获胜"
  if (refs.getChainType(state) === "GG" || refs.getChainType(state) === "WW")
    return "情侣同生共死：一人出局另一人立即殉情（丘比特属好人阵营）"
  if (loversGone.value) return "第三方已解散，回归好狼对抗"
  return "情侣已连接，身份确认后判定链型"
})

/** idle 步骤：开局重置后进入第 1 晚 */
function doBeginGame() {
  actions.startGame()
  doFlow()
}
function doProphetCheck(v: string) {
  snapshot()
  const r = actions.prophetCheck(v)
  if (typeof r === "string") return message.error(r)
  if (r) {
    const target = state.players.find((x) => x.name === r.name)
    const lbl = target ? refs.playerLabel(target) : r.name
    const verdict = r.isWolf ? "狼人🐺" : "好人👼"
    checkResult.value = `查验结果：${lbl} 是【${verdict}】`
    effect("prophet", "magic", `${lbl} → ${verdict}`)
  } else {
    message.info("本晚不验人，已记录")
    checkResult.value = "本晚不验人"
  }
}
function doProphetClose() {
  markDoneStep("prophet")
  checkResult.value = ""
  playVoice("prophet_close")
}
function doGuard(v: string) {
  snapshot()
  const err = actions.guardDo(v, false)
  if (err) return message.error(err)
  const target = state.players.find((x) => x.name === v)
  effect("guard", "guard", target ? `守卫：${refs.playerLabel(target)}` : "")
  playVoice("guard_close")
}
function openWitchModal(type: "save" | "poison") {
  if (type === "save") {
    if (!state.nightWolfKill) return message.warning("本晚还没有被刀者，无法使用解药")
    if (state.witchSaveUsed) return message.warning("解药已用完")
    if (state.nightUsedDrug !== null) return message.warning("本晚已用过一瓶药")
    witchModal.value = "save"
  }
}
function confirmWitch() {
  if (witchModal.value !== "save") return
  snapshot()
  const err = actions.witchSave()
  if (err) return message.error(err)
  const t = state.players.find((x) => x.name === state.nightWolfKill)
  message.success("已使用解药救人")
  effect("witch", "witch", t ? `解药救：${refs.playerLabel(t)}` : "解药救：被刀者")
  witchModal.value = null
  if (state.voiceEnabled) speak(refs.resolveVoice(state, "witch_close"))
}
function doWitchPoison(v: string) {
  snapshot()
  const err = actions.witchPoison(v)
  if (err) return message.error(err)
  const t = state.players.find((x) => x.name === v)
  message.success(`已对 ${v} 用毒`)
  effect("witch", "witch", t ? `毒药：${refs.playerLabel(t)}` : `毒药：${v}`)
  if (state.voiceEnabled) speak(refs.resolveVoice(state, "witch_close"))
}
function doWitchDone() {
  // 解药毒药都用完时直接闭眼，不再二次确认
  if (state.witchSaveUsed && state.witchPoisonUsed) {
    markDoneStep("witch")
    playVoice("witch_close")
    return
  }
  modal.confirm({
    title: "本轮不开药？",
    content: "女巫本晚不使用解药和毒药，确认后闭眼",
    okText: "确认不开药",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      markDoneStep("witch")
      playVoice("witch_close")
    },
  })
}
function doKnightOpen() {
  markDoneStep("knight")
  playVoice("knight_close")
}
function doHunterOpen() {
  markDoneStep("hunterOpen")
  playVoice("hunter_close")
}
function doIdiotOpen() {
  markDoneStep("idiotOpen")
  playVoice("idiot_close")
}
function doHunterShoot(v: string) {
  snapshot()
  const err = actions.hunterShoot(v)
  if (err) return message.error(err)
  effect("hunter", "gunshot")
  checkSheriffDeath()
}
function doHunterGiveUp() {
  modal.confirm({
    title: "放弃开枪？",
    content: "猎人放弃开枪，确认后继续",
    okText: "确认放弃",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      snapshot()
      actions.hunterGiveUp()
    },
  })
}
function doWolfKingShoot(v: string) {
  snapshot()
  const err = actions.wolfKingShoot(v)
  if (err) return message.error(err)
  effect("hunter", "gunshot")
  checkSheriffDeath()
}
function doWolfKingGiveUp() {
  modal.confirm({
    title: "放弃开枪？",
    content: "狼王放弃开枪，确认后继续",
    okText: "确认放弃",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      snapshot()
      actions.wolfKingGiveUp()
    },
  })
}
function confirmSkip(title: string, content: string, fn: () => void) {
  modal.confirm({
    title,
    content,
    okText: "确认",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk: fn,
  })
}
function doJingHui(v: string) {
  snapshot()
  const owner = v
  const ownerP = owner ? state.players.find((x) => x.name === owner) : null
  actions.setJingHui(owner, false)
  markDone("jinghui")
  if (ownerP && refs.isWolfRole(ownerP.role)) {
    message.success(`⚠️ ${refs.playerLabel(ownerP)} 狼人悍跳拿到警徽！`)
  } else {
    message.success("警徽已设置")
  }
}
function openJinghuiModal() {
  flow1Sel.value = state.jingHuiFlow[0] || ""
  flow2Sel.value = state.jingHuiFlow[1] || ""
  jingHuiOwner.value = ""
  jinghuiModal.value = true
}
/** 参考刀人弹窗：弹出单选玩家列表，重复选择同一人时自动交换顺位 */
function setFlow(slot: 1 | 2, v: string) {
  if (slot === 1) {
    if (v === flow2Sel.value) flow2Sel.value = flow1Sel.value
    flow1Sel.value = v
  } else {
    if (v === flow1Sel.value) flow1Sel.value = flow2Sel.value
    flow2Sel.value = v
  }
}
function finishJinghuiSetup() {
  snapshot()
  const owner = jingHuiOwner.value
  const ownerP = owner ? state.players.find((x) => x.name === owner) : null
  if (owner) actions.setJingHui(owner, false)
  actions.setJingHuiFlow([flow1Sel.value, flow2Sel.value].filter(Boolean))
  jinghuiModal.value = false
  if (ownerP && refs.isWolfRole(ownerP.role)) {
    message.success(`⚠️ ${refs.playerLabel(ownerP)} 狼人悍跳拿到警徽！`)
  } else if (owner) {
    message.success("警徽已移交")
  } else {
    message.success("警徽设置已保存")
  }
}
function checkSheriffDeath() {
  if (state.finished || !state.jingHui) return
  const holder = state.players.find((p) => p.name === state.jingHui)
  if (holder && !holder.alive) {
    deadSheriff.value = holder.name
    sheriffDeathModal.value = true
  }
}
/** 猎人可开枪时语音提示法官让猎人选择开枪目标 */
function promptHunterShot() {
  if (state.hunterShotPending && !state.finished) {
    setTimeout(() => {
      if (state.hunterShotPending && !state.finished) playVoice("hunter")
    }, 4000)
  }
}
function onSheriffAuto() {
  sheriffDeathModal.value = false
  const next = actions.autoTransferJingHui()
  if (next) message.success(`警徽按警徽流移交给 ${next}`)
  else message.warning("警徽流无人可接，警徽流失")
}
function onSheriffManual() {
  sheriffDeathModal.value = false
  openJinghuiModal()
}
function onSheriffLose() {
  sheriffDeathModal.value = false
  actions.loseJingHui()
  message.warning("警徽流失")
}
function doFinishVote(v: string) {
  const outP = state.players.find((p) => p.name === v)
  if (!outP) return message.error("请选择放逐出局对象")
  snapshot()
  if (outP.role === "白痴" && !outP.mark.idiotFlipped) {
    // 白痴被放逐 → 弹窗询问翻牌免死
    modal.confirm({
      title: "🙊 白痴被放逐",
      content: `${refs.playerLabel(outP)} 被放逐，是否翻牌免死？`,
      okText: "翻牌免死",
      cancelText: "直接出局",
      onOk() {
        const err = actions.finishVote(outP.name, true)
        if (err) message.error(err)
        else {
          effect("idiot", "boing")
          playVoice("idiot_flip")
          markDone("vote")
        }
      },
      onCancel() {
        const err = actions.finishVote(outP.name, false)
        if (err) message.error(err)
        else {
          markDone("vote")
          if (state.hunterShotPending) playVoice("hunter")
          checkSheriffDeath()
          lastWordsName.value = outP.name
          lastWordsShow.value = true
        }
      },
    })
    return
  }
  const err = actions.finishVote(v, false)
  if (err) return message.error(err)
  markDone("vote")
  if (state.hunterShotPending) playVoice("hunter")
  checkSheriffDeath()
  // 放逐玩家有遗言，弹计时
  lastWordsName.value = v
  lastWordsShow.value = true
}
function doWolfBaoZha(v: string) {
  snapshot()
  stopSpeech()
  const err = actions.wolfBaoZha(v)
  if (err) return message.error(err)
  message.success("狼人自爆，直接进入黑夜")
  effect("explode", "explode")
  playVoice("explode")
  checkSheriffDeath()
}
function doWWKBoom(tar: string) {
  const wwk = wwkObj.value
  if (!wwk) return message.error("本局没有白狼王")
  snapshot()
  stopSpeech()
  const err = actions.wolfKingBaoZha(wwk.name, tar)
  if (err) return message.error(err)
  message.success("白狼王自爆带人，直接进入黑夜")
  effect("explode", "explode")
  playVoice("wwk_boom")
  checkSheriffDeath()
}
function doKnightDuel(v: string) {
  snapshot()
  const tar = state.players.find((x) => x.name === v)
  const tarRole = tar?.role || ""
  const err = actions.knightDuel(v)
  if (err) return message.error(err)
  const lbl = tar ? refs.playerLabel(tar) : v
  const isWolf = refs.isWolfRole(tarRole)
  message.success(`骑士决斗：${lbl}${isWolf ? " 戳中狼人" : " 戳错，骑士出局"}`)
  effect("knight", "sword", `决斗对象：${lbl}`)
  playVoice(isWolf ? "knight_duel_wolf" : "knight_duel_good")
  checkSheriffDeath()
}
function doDawn() {
  actions.autoFillCivilians()
  if (state.players.some((p) => !p.role)) {
    return message.error("还有玩家未确认身份，请先完成所有睁眼确认（剩余玩家会自动补为平民）后再天亮")
  }
  snapshot()
  const before = aliveList.value.map((p) => p.name)
  const err = actions.dawnSettle()
  if (err) return message.error(err)
  const after = aliveList.value.map((p) => p.name)
  lastDawnDeaths.value = before.filter((n) => !after.includes(n))
  message.success("天亮了，已结算昨夜")
  const deathInfo = lastDawnDeaths.value
    .map((n) => {
      const p = state.players.find((x) => x.name === n)
      return p ? refs.playerLabel(p) : n
    })
    .join("、")
  // 全屏过场动画：天亮展示平安夜；死亡名单放到骷髅(死亡)页
  effect("dawn", "rooster", lastDawnDeaths.value.length ? "天亮了" : "平安夜")
  // 平安夜 / 有人出局 的语音播报
  if (lastDawnDeaths.value.length) {
    playVoice("dawn")
  } else {
    playVoice("dawn_peace")
  }
  // 出局播报（只读号码）；对局已结束时交给胜利播报
  if (lastDawnDeaths.value.length && !state.finished) {
    suppressStepVoiceUntil = Date.now() + 5000
    setTimeout(() => {
      if (state.finished) return
      // 骷髅死亡页：展示死亡玩家信息
      effect("death", "death", `昨夜死亡：${deathInfo}`)
      const poisonedHunter = lastDawnDeaths.value.find((n) => {
        const p = state.players.find((x) => x.name === n)
        return p?.role === "猎人" && p.mark.hunterIsPoisoned
      })
      if (poisonedHunter) playVoice("hunter_poisoned")
      const nos = lastDawnDeaths.value.map((n) => {
        const p = state.players.find((x) => x.name === n)
        return `${p?.no || "?"}`
      })
      const txt =
        nos.length === 1
          ? `${nos[0]}号玩家出局，bye-bye，下局见！`
          : `昨夜${nos.length === 2 ? "双死" : `${nos.length}死`}，${nos.join("、")}号玩家出局，bye-bye，下局见！`
      speakQueue([txt])
    }, 700)
  }
  checkSheriffDeath()
  promptHunterShot()
}
function doFlow() {
  const enteringNight = state.phase !== "night"
  actions.flowToggle()
  if (enteringNight) {
    playSfx("howl")
    if (state.voiceEnabled) playVoice("night_start")
  }
}

function openNextGame() {
  actions.startNextGame()
  message.success(`第 ${sessionNo.value} 局已开启，保留上一局玩家，请直接分配角色`)
}

// ===== 音效/动画 =====
const overlay = ref<{ type: string; key: number; result?: string } | null>(null)
let overlayTimer: ReturnType<typeof setTimeout> | null = null
const EFFECT_META: Record<string, { emoji: string; bg: string; label: string }> = {
  wolf: { emoji: "🐺", bg: "rgba(160,20,20,.92)", label: "狼人出刀" },
  prophet: { emoji: "🔮", bg: "rgba(80,50,150,.92)", label: "预言家查验" },
  guard: { emoji: "🛡️", bg: "rgba(30,80,150,.92)", label: "守卫守护" },
  witch: { emoji: "🧪", bg: "rgba(20,120,80,.92)", label: "女巫用药" },
  hunter: { emoji: "🔫", bg: "rgba(190,110,20,.92)", label: "猎人开枪" },
  idiot: { emoji: "🙊", bg: "rgba(190,150,20,.92)", label: "白痴翻牌" },
  dawn: { emoji: "🌅", bg: "rgba(210,130,40,.88)", label: "天亮了" },
  explode: { emoji: "💥", bg: "rgba(190,50,20,.92)", label: "狼人自爆" },
  knight: { emoji: "⚔️", bg: "rgba(120,120,150,.92)", label: "骑士决斗" },
  cupid: { emoji: "💘", bg: "rgba(190,60,110,.92)", label: "丘比特连人" },
  death: { emoji: "💀", bg: "rgba(70,70,90,.88)", label: "玩家出局" },
}
function effect(type: string, sfx?: SfxName, result?: string) {
  if (sfx) playSfx(sfx)
  overlay.value = { type, key: Date.now(), result }
  if (overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(() => (overlay.value = null), 2200)
}
</script>

<template>
  <div class="panel">
    <a-card :bordered="false">
      <!-- 板子配置：最顶部，可换行展示全部角色 -->
      <a-tooltip :title="boardLabel" placement="bottomLeft">
        <div class="board-config-line">🎲 {{ boardSummary }}</div>
      </a-tooltip>

      <a-flex :justify="'space-between'" :wrap="'wrap'" :gap="12" style="margin-bottom: 12px">
        <a-space :wrap="true">
          <a-tag color="geekblue">阶段：{{ phaseText }}</a-tag>
          <a-tag color="purple">第 {{ state.round }} 晚</a-tag>
          <a-tag :color="aliveCount > 0 ? 'green' : 'error'">存活 {{ aliveCount }} / {{ state.players.length }}</a-tag>
          <a-tooltip v-if="state.lovers.length" :title="loversTip">
            <a-tag :color="thirdActive ? 'purple' : 'volcano'" style="cursor: help">
              💘 {{ loversLabel }}<template v-if="chainText"> · {{ chainText }}</template>
            </a-tag>
          </a-tooltip>
          <a-tag v-if="state.jingHui" color="gold">👑 警长：{{ jingHuiLabel }}</a-tag>
          <a-tag v-if="aliveCount <= 2 && !state.finished" color="volcano">⚡ 最后一推！</a-tag>
          <a-tag v-if="state.hunterShotPending" color="error">🔴 猎人可开枪</a-tag>
        </a-space>
      </a-flex>

      <!-- 天亮公布昨夜情况已并入「对局流程进度」的每一晚标题后 -->

      <!-- 当前步骤卡片 -->
      <a-card class="step-card" :bordered="false">
        <!-- 开始游戏 -->
        <div v-if="currentStep === 'idle'" class="step-body">
          <div class="step-emoji">🚀</div>
          <h3 class="step-title">开始第 1 晚</h3>
          <p class="small" style="text-align: center">请先发角色卡，身份将在夜晚睁眼时由法官确认</p>
          <a-button type="primary" size="large" style="height: 48px; min-width: 220px" @click="doBeginGame">🌙 发牌完毕，进入夜晚</a-button>
        </div>

        <!-- 丘比特连人 -->
        <div v-else-if="currentStep === 'cupid'" class="step-body">
          <div class="step-emoji">💘</div>
          <h3 class="step-title">丘比特连人</h3>
          <template v-if="!hasCupid">
            <p class="small" style="text-align: center">丘比特睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认丘比特（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('丘比特', v))">💘 确认丘比特</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">
              丘比特：{{ cupidObj ? refs.playerLabel(cupidObj) : "-" }}
              <template v-if="state.lovers.length">｜已连：{{ loversLabel }}<template v-if="chainText">（{{ chainText }}）</template></template>
            </p>
            <a-button v-if="state.lovers.length < 2" type="primary" size="large" @click="openCupidConnect">💘 选择两位情侣</a-button>
            <a-button v-else type="primary" size="large" @click="finishCupidStep">✅ 确认连人，闭眼</a-button>
            <a-button v-if="!state.lovers.length" type="text" style="margin-top: 12px" @click="skipCupid">本轮不连人</a-button>
          </template>
        </div>

        <!-- 守卫 -->
        <div v-else-if="currentStep === 'guard'" class="step-body">
          <div class="step-emoji">🛡️</div>
          <h3 class="step-title">守卫守人</h3>
          <template v-if="!hasGuard">
            <p class="small" style="text-align: center">守卫睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认守卫（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('守卫', v))">🛡️ 确认守卫</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">
              守卫：{{ guardObj ? refs.playerLabel(guardObj) : "-" }}
              <template v-if="state.guardLastTarget">｜上局守护 {{ state.guardLastTarget }}（不能同守）</template>
            </p>
            <a-button type="primary" size="large" @click="openPicker('选择守护对象', aliveOptions, (v) => doGuard(v))">🛡️ 确认守人</a-button>
            <a-button type="text" style="margin-top: 12px" @click="confirmSkip('本轮不守？', '守卫本晚不守护任何人，确认后进入下一步', () => markDoneStep('guard'))">本轮不守</a-button>
          </template>
        </div>

        <!-- 狼人刀人 -->
        <div v-else-if="currentStep === 'wolf'" class="step-body">
          <div class="step-emoji">🌑</div>
          <h3 class="step-title">狼人刀人</h3>
          <template v-if="!wolfAllConfirmed">
            <p class="small" style="text-align: center">狼人阵营睁眼，法官按身份逐个确认</p>
            <a-button v-if="(wolfCampStatus['狼人']?.have || 0) < (wolfCampStatus['狼人']?.need || 0)" danger size="large" @click="openWolfConfirm">🐺 确认狼人（{{ wolfCount }}/{{ wolfNeed }}）</a-button>
            <a-button v-for="cr in wolfCampSingleUnconfirmed" :key="cr" type="primary" size="large" @click="openPicker(`确认${cr}（睁眼认人）`, unassignedAliveOptions, (v) => doConfirmRole(cr, v))">{{ refs.ROLE_EMOJI[cr] || "" }} 确认{{ cr }}</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">狼人阵营已确认，请开始商量刀人（选中即自动标记自刀）</p>
            <a-button v-if="!state.nightWolfKill" danger size="large" @click="openPicker('选择被刀对象', aliveOptions, (v) => doWolfKill(v))">🌑 确认刀人</a-button>
            <div v-else class="prophet-result">
              <div class="prophet-result-main">
                🌑 已刀：{{ (() => { const v = state.players.find((x) => x.name === state.nightWolfKill); return v ? refs.playerLabel(v) : state.nightWolfKill })() }}
              </div>
              <a-button type="primary" danger @click="doWolfClose">已确认狼人闭眼</a-button>
            </div>
          </template>
        </div>

        <!-- 预言家 -->
        <div v-else-if="currentStep === 'prophet'" class="step-body">
          <div class="step-emoji">🔮</div>
          <h3 class="step-title">预言家验人</h3>
          <template v-if="!hasProphet">
            <p class="small" style="text-align: center">预言家睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认预言家（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('预言家', v))">🔮 确认预言家</a-button>
          </template>
          <template v-else>
            <a-button v-if="!checkResult" type="primary" size="large" @click="openPicker('选择查验对象', [{ value: refs.NO_CHECK, label: '🙅 不验' }, ...aliveOptions], (v) => doProphetCheck(v))">🔮 确认查验</a-button>
            <div v-else class="prophet-result">
              <div class="prophet-result-main">{{ checkResult }}</div>
              <a-button type="primary" danger @click="doProphetClose">已告知预言家，闭眼</a-button>
            </div>
          </template>
        </div>

        <!-- 女巫 -->
        <div v-else-if="currentStep === 'witch'" class="step-body">
          <div class="step-emoji">🧪</div>
          <h3 class="step-title">女巫操作</h3>
          <template v-if="!hasWitch">
            <p class="small" style="text-align: center">女巫睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认女巫（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('女巫', v))">🧙 确认女巫</a-button>
          </template>
          <template v-else>
          <p class="small" style="text-align: center; margin-bottom: 4px">
            本晚被刀：<b class="key-name">{{ state.nightWolfKill || "尚未记录" }}</b>
          </p>
          <div class="bottles">
            <div
              class="bottle"
              :class="{ used: state.witchSaveUsed, clickable: !state.witchSaveUsed }"
              @click="!state.witchSaveUsed && openWitchModal('save')"
            >
              <div class="bottle-emoji">💚</div>
              <div class="bottle-name">解药</div>
              <div class="bottle-state" :class="{ 'bottle-done': state.witchSaveUsed }">{{ state.witchSaveUsed ? "已用" : "点击使用" }}</div>
            </div>
            <div
              class="bottle bottle-purple"
              :class="{ used: state.witchPoisonUsed, clickable: !state.witchPoisonUsed }"
              @click="!state.witchPoisonUsed && openPicker('选择毒杀目标', aliveOptions, (v) => doWitchPoison(v))"
            >
              <div class="bottle-emoji">🟣</div>
              <div class="bottle-name">毒药</div>
              <div class="bottle-state" :class="{ 'bottle-done': state.witchPoisonUsed }">{{ state.witchPoisonUsed ? "已用" : "点击使用" }}</div>
            </div>
          </div>
          <div class="small">一晚只能使用一瓶；点击药瓶使用</div>

          <a-space direction="vertical" style="width: 100%; max-width: 360px">
            <a-button block style="margin-top: 4px" @click="doWitchDone">本轮不开药，闭眼</a-button>
          </a-space>

          <div v-if="state.nightWitchSave" class="small">💚 已解救：{{ labelOf(state.nightWitchSave) }}</div>
          <div v-if="state.nightWitchPoison" class="small">☠️ 已毒杀：{{ labelOf(state.nightWitchPoison) }}</div>
          </template>
        </div>

        <!-- 猎人睁眼 -->
        <div v-else-if="currentStep === 'hunterOpen'" class="step-body">
          <div class="step-emoji">🔫</div>
          <h3 class="step-title">猎人睁眼</h3>
          <template v-if="!hasHunter">
            <p class="small" style="text-align: center">猎人睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认猎人（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('猎人', v))">🔫 确认猎人</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">确认你的枪状态，白天/夜里按规则触发开枪</p>
            <a-tag
              v-if="hunterStatus"
              size="large"
              :color="state.hunterShotPending ? 'error' : hunterObj?.mark.hunterIsPoisoned ? 'default' : 'green'"
            >
              {{ hunterStatus }}
            </a-tag>
            <a-button type="primary" @click="doHunterOpen">确认身份，闭眼</a-button>
          </template>
        </div>

        <!-- 白痴睁眼 -->
        <div v-else-if="currentStep === 'idiotOpen'" class="step-body">
          <div class="step-emoji">🙊</div>
          <h3 class="step-title">白痴睁眼</h3>
          <template v-if="!hasIdiot">
            <p class="small" style="text-align: center">白痴睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认白痴（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('白痴', v))">🙊 确认白痴</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">确认身份，继续闭眼摸鱼</p>
            <a-button type="primary" @click="doIdiotOpen">确认身份，闭眼</a-button>
          </template>
        </div>

        <!-- 骑士睁眼 -->
        <div v-else-if="currentStep === 'knight'" class="step-body">
          <div class="step-emoji">⚔️</div>
          <h3 class="step-title">骑士睁眼</h3>
          <template v-if="!hasKnight">
            <p class="small" style="text-align: center">骑士睁眼，法官确认其身份</p>
            <a-button type="primary" size="large" @click="openPicker('确认骑士（睁眼认人）', unassignedAliveOptions, (v) => doConfirmRole('骑士', v))">⚔️ 确认骑士</a-button>
          </template>
          <template v-else>
            <p class="small" style="text-align: center">确认身份后闭眼，白天可用「骑士决斗」</p>
            <a-button type="primary" @click="doKnightOpen">确认身份，闭眼</a-button>
          </template>
        </div>

        <!-- 天亮 -->
        <div v-else-if="currentStep === 'dawn'" class="step-body">
          <div class="step-emoji">🌅</div>
          <h3 class="step-title">天亮了</h3>
          <p class="small" style="text-align: center">自动处理昨夜死亡并判定胜负</p>
          <a-button type="primary" danger size="large" style="height: 48px; min-width: 220px" @click="doDawn">☀️ 天亮（公布昨夜）</a-button>
        </div>

        <!-- 猎人开枪 -->
        <div v-else-if="currentStep === 'hunter'" class="step-body">
          <div class="step-emoji">🔫</div>
          <h3 class="step-title">猎人开枪</h3>
          <p class="small" style="text-align: center">本局猎人：{{ hunterObj ? refs.playerLabel(hunterObj) : "-" }}</p>
          <a-tag v-if="hunterStatus" :color="state.hunterShotPending ? 'error' : 'default'" size="large">
            状态：{{ hunterStatus }}
          </a-tag>
          <a-button type="primary" size="large" @click="openPicker('选择带走目标', aliveOptions, (v) => doHunterShoot(v))">🔫 确认开枪带走</a-button>
          <a-button style="margin-top: 8px" @click="doHunterGiveUp">放弃开枪</a-button>
        </div>

        <!-- 狼王开枪（狼枪） -->
        <div v-else-if="currentStep === 'wolfkingShot'" class="step-body">
          <div class="step-emoji">🔫</div>
          <h3 class="step-title">狼王开枪</h3>
          <p class="small" style="text-align: center">本局狼王：{{ wolfKingObj ? refs.playerLabel(wolfKingObj) : "-" }}</p>
          <a-tag v-if="wolfKingStatus" :color="state.wolfKingShotPending ? 'error' : 'default'" size="large">
            状态：{{ wolfKingStatus }}
          </a-tag>
          <a-button type="primary" danger size="large" @click="openPicker('选择狼王带走目标', aliveOptions, (v) => doWolfKingShoot(v))">🔫 确认开枪带走</a-button>
          <a-button style="margin-top: 8px" @click="doWolfKingGiveUp">放弃开枪</a-button>
        </div>

        <!-- 竞选警长 -->
        <div v-else-if="currentStep === 'jinghui'" class="step-body">
          <div class="step-emoji">📢</div>
          <h3 class="step-title">竞选警长</h3>
          <a-button type="primary" size="large" @click="openPicker('选择警长', aliveOptions, (v) => doJingHui(v))">📢 设置警长</a-button>
          <a-button type="text" style="margin-top: 12px" @click="confirmSkip('本轮不竞选？', '本局不竞选警长，确认后进入下一步', () => markDoneStep('jinghui'))">本轮不竞选</a-button>
        </div>

        <!-- 竞选警长后公布首夜情况（死讯 + 验人结果） -->
        <div v-else-if="currentStep === 'prophetReport'" class="step-body">
          <div class="step-emoji">📢</div>
          <h3 class="step-title">公布首夜情况</h3>
          <p class="small" style="text-align: center">竞选警长结束，法官公布首夜死讯与验人结果</p>
          <div v-if="lastDawnDeaths.length" class="prophet-result-main">
            ☠️ 昨夜死亡：{{ lastDawnDeaths.map((n) => labelOf(n)).join("、") }}
          </div>
          <div v-else class="prophet-result-main">☠️ 昨夜平安夜</div>
          <a-tag v-if="state.prophetReport" color="geekblue" size="large" style="font-size: 16px; padding: 6px 14px">{{ state.prophetReport }}</a-tag>
          <a-button type="primary" size="large" @click="markDoneStep('prophetReport')">已公布，进入发言</a-button>
        </div>

        <!-- 发言环节 -->
        <div v-else-if="currentStep === 'speech'" class="step-body">
          <div class="step-emoji">🗣️</div>
          <h3 class="step-title">发言环节</h3>
          <p class="small" style="text-align: center">{{ speechOrderHint }}（计时 {{ SPEECH_SECONDS }}s）</p>

          <div class="speech-timer-box">
            <span class="countdown" :class="{ warning: speechRunning && speechLeft <= 7 }">
              {{ speechRunning ? `${speechLeft}s` : "待开始" }}
            </span>
            <a-button type="primary" size="large" block @click="speechRunning ? stopSpeech() : startSpeech()">
              {{ speechRunning ? "⏹ 停止 / 重置" : "▶ 开始计时" }}
            </a-button>
          </div>

          <div v-if="!state.jingHui" class="speech-rand-box">
            <div class="speech-rand-title">🎲 无警长 · 随机发言顺序</div>
            <div v-if="randNo" class="speech-rand-result">
              <span class="speech-rand-num">{{ randNo }}</span>
              <span class="speech-rand-hint">号玩家先发言<template v-if="randPlayer">（{{ randPlayer.name }}）</template></span>
            </div>
            <div v-else class="speech-rand-hint">抽一个号决定谁先发言</div>
            <a-button type="dashed" size="large" block @click="rollRand">🎲 {{ randNo ? "重新抽随机发言" : "抽随机发言" }}</a-button>
          </div>

          <a-button type="primary" size="large" style="margin-top: 6px" @click="finishSpeech">💬 发言结束，进入投票</a-button>
        </div>

        <!-- 放逐投票 -->
        <div v-else-if="currentStep === 'vote'" class="step-body">
          <div class="step-emoji">🗳️</div>
          <h3 class="step-title">放逐投票</h3>
          <p class="small" style="text-align: center">仅需选择被放逐的玩家（逐人投票记分已移除）</p>
          <a-button danger type="primary" size="large" @click="openPicker('选择放逐出局对象', aliveOptions, (v) => doFinishVote(v))">🗳️ 确认放逐</a-button>
          <a-button type="text" style="margin-top: 12px" @click="confirmSkip('无人出局？', '本日无人被放逐，确认后进入夜晚', () => markDoneStep('vote'))">无人出局，进入夜晚</a-button>
        </div>

        <!-- 进入夜晚 -->
        <div v-else-if="currentStep === 'night'" class="step-body">
          <div class="step-emoji">🌙</div>
          <h3 class="step-title">进入夜晚</h3>
          <a-button type="primary" size="large" style="height: 48px; min-width: 220px" @click="doFlow">🌙 进入夜晚（第 {{ state.round + 1 }} 晚）</a-button>
        </div>

        <!-- 本局结束 -->
        <div v-else-if="currentStep === 'end'" class="step-body">
          <div class="step-emoji">🏁</div>
          <h3 class="step-title">本局已结束</h3>
          <p class="small" style="text-align: center">积分已保存到「📊 分数明细」与历史记录，本局对局操作已锁定</p>
          <a-button type="primary" size="large" style="height: 48px; min-width: 220px" @click="openNextGame">
            ➡️ 开启第 {{ sessionNo }} 局
          </a-button>
        </div>
      </a-card>

      <!-- 遗言计时（白天出局玩家） -->
      <a-card v-if="lastWordsShow && state.phase === 'day'" class="last-words-card" :bordered="false">
        <div class="last-words-title">💬 遗言（{{ labelOf(lastWordsName) }}）</div>
        <div class="last-words-timer">
          <span class="countdown" :class="{ warning: lastWordsRunning && lastWordsLeft <= 7 }">
            {{ lastWordsRunning ? `${lastWordsLeft}s` : "待开始" }}
          </span>
          <a-button type="primary" @click="lastWordsRunning ? resetLastWords() : startLastWords()">
            {{ lastWordsRunning ? "🔄 重置时间" : "▶ 开始遗言计时" }}
          </a-button>
        </div>
      </a-card>

      <!-- 对局流程进度（可折叠） -->
      <a-collapse v-if="flowGroups.length" style="margin-top: 12px">
        <a-collapse-panel key="flow" header="📊 对局流程进度（含每晚具体情况）">
          <div v-for="[night, steps] in flowGroups" :key="night" class="flow-night">
            <span class="flow-night-title">第 {{ night }} 晚</span>
            <a-tag
              v-if="nightSituation(steps)"
              :color="nightSituation(steps) === '平安夜' ? 'green' : 'error'"
              style="padding: 2px 10px"
            >
              {{ nightSituation(steps) }}
            </a-tag>
            <a-space :wrap="true" :size="6">
              <a-tag
                v-for="(f, i) in steps"
                :key="i"
                color="blue"
                style="padding: 2px 10px"
              >
                {{ flowText(f) }}
              </a-tag>
            </a-space>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <!-- 左右两列悬浮座位牌 -->
      <SeatBoard
        v-if="state.players.length"
        :players="state.players"
        floating
        show-lover
        :lovers="state.lovers"
        :third-members="thirdMembersList"
        :judge="state.judge"
        :jing-hui="state.jingHui"
      />

      <!-- 语音配置 + 日志 -->
      <a-collapse style="margin-top: 12px">
        <a-collapse-panel key="log" header="📜 对局日志">
          <div class="logbox">
            <div v-for="(l, i) in state.globalLog" :key="i">{{ i + 1 }}. {{ displayLog(l) }}</div>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <!-- 语音配置抽屉（悬浮按钮打开） -->
      <a-drawer v-model:open="voiceDrawer" title="🔊 语音播报配置" placement="right" width="460">
        <div class="voice-sec-title">🎤 语音风格</div>
        <a-select
          :value="getVoiceStyle()"
          style="width: 100%; margin-bottom: 4px"
          :options="voiceStyleOptions()"
          @change="(v: string) => { setVoiceStyle(v as never); playStepVoice() }"
        />
        <div class="small" style="color:#888; margin-bottom: 16px">系统 TTS 模拟角色音，切换后立即试听当前步</div>

        <div class="voice-sec-title">🔊 播报开关</div>
        <a-space style="margin-bottom: 16px" :wrap="true">
          <a-switch :checked="state.voiceEnabled" @change="actions.setVoiceEnabled(!!$event)" />
          <span class="small">{{ state.voiceEnabled ? "已开启" : "已关闭" }}</span>
          <a-button size="small" @click="stopSpeak">停止播报</a-button>
        </a-space>

        <div class="voice-sec-title">📝 播报文案</div>
        <a-row :gutter="[12, 10]">
          <a-col v-for="st in Object.entries(refs.DEFAULT_VOICES)" :key="st[0]" :xs="24" :sm="12">
            <div class="voice-row">
              <div class="voice-row-label">{{ VOICE_LABEL[st[0]] || st[0] }}</div>
              <a-space :wrap="false" style="width: 100%">
                <a-input
                  style="flex: 1; min-width: 0"
                  :value="state.voices[st[0]] || ''"
                  placeholder="输入播报文案"
                  @change="actions.setVoice(st[0], ($event.target as HTMLInputElement).value)"
                />
                <a-button size="small" @click="playVoice(st[0])">🔊</a-button>
              </a-space>
            </div>
          </a-col>
        </a-row>
      </a-drawer>

      <!-- 悬浮按钮：自爆 + 警徽流 + 警徽移交 + 骑士决斗 + 回退一步 + 重播当前步 + 语音配置 -->
      <div class="floating-actions">
        <a-tooltip v-if="hasWWK && state.phase === 'day' && !state.skipVote && !state.finished" title="白狼王自爆带人">
          <a-button class="fab" type="primary" danger shape="circle" size="large" @click="openPicker('选择白狼王带走目标', wwkTarOptions, (v) => doWWKBoom(v))">👑💥</a-button>
        </a-tooltip>
        <a-tooltip v-if="state.phase === 'day' && !state.skipVote && !state.finished" title="狼人自爆（跳过本日投票，直接入夜）">
          <a-button class="fab" type="primary" danger shape="circle" size="large" @click="openPicker('选择自爆狼人', wolfPlainOptions, (v) => doWolfBaoZha(v))">💥</a-button>
        </a-tooltip>
        <a-tooltip v-if="state.jingHui && !state.finished" title="警徽设置（移交 / 警徽流）">
          <a-button class="fab" type="default" shape="circle" size="large" @click="openJinghuiModal">👑</a-button>
        </a-tooltip>
        <a-tooltip v-if="hasKnight && !state.knightDuelUsed && state.phase === 'day' && !state.finished" title="骑士决斗（每局一次）">
          <a-button class="fab" type="default" shape="circle" size="large" @click="openPicker('选择决斗对象', aliveOptions, (v) => doKnightDuel(v))">⚔️</a-button>
        </a-tooltip>
        <a-tooltip title="回退上一步">
          <a-button class="fab" type="primary" danger shape="circle" size="large" :disabled="!canUndo" @click="doUndo">↩️</a-button>
        </a-tooltip>
        <a-tooltip title="重复播报当前步（防止对应玩家没睁眼）">
          <a-button class="fab" type="primary" shape="circle" size="large" @click="playStepVoice">🔊</a-button>
        </a-tooltip>
        <a-tooltip title="语音播报配置">
          <a-button class="fab" type="default" shape="circle" size="large" @click="voiceDrawer = true">⚙️</a-button>
        </a-tooltip>
      </div>

      <!-- 左下悬浮：角色玩法 + 计分速查 -->
      <RoleHelp :roles="refs.getBoardRoles(state)" />

      <!-- 弹窗：确认狼人（首夜睁眼认人） -->
      <a-modal v-model:open="wolfConfirmOpen" title="🐺 确认狼人（睁眼认人）" :footer="null" width="420px" :mask-closable="false">        <p class="small">勾选本板子的狼人玩家（{{ wolfSel.length }}/{{ wolfNeed }}），选满 {{ wolfNeed }} 个后确认</p>
        <a-checkbox-group v-model:value="wolfSel" style="width: 100%">
          <div v-for="p in aliveList.filter((x) => !x.role || x.role === '狼人')" :key="p.name" class="wolf-pick-item">
            <a-checkbox :value="p.name" :disabled="!wolfSel.includes(p.name) && wolfSel.length >= wolfNeed">
              {{ refs.playerLabel(p) }}
            </a-checkbox>
          </div>
        </a-checkbox-group>
        <a-button type="primary" danger block style="margin-top: 12px" @click="confirmWolfSel">确认狼人</a-button>
      </a-modal>

      <!-- 弹窗：丘比特连人（首夜） -->
      <a-modal v-model:open="cupidConnectOpen" title="💘 丘比特连人（首夜）" :footer="null" width="420px" :mask-closable="false">
        <p class="small">勾选两位玩家作为情侣（可连自己；{{ cupidSel.length }}/2，选满 2 人后确认）</p>
        <a-checkbox-group v-model:value="cupidSel" style="width: 100%">
          <div v-for="p in aliveList" :key="p.name" class="wolf-pick-item">
            <a-checkbox :value="p.name" :disabled="!cupidSel.includes(p.name) && cupidSel.length >= 2">
              {{ p.name === cupidObj?.name ? "💘 " : "" }}{{ refs.playerLabel(p) }}
            </a-checkbox>
          </div>
        </a-checkbox-group>
        <a-button type="primary" block style="margin-top: 12px" :disabled="cupidSel.length !== 2" @click="confirmCupidConnect">确认连人</a-button>
      </a-modal>

      <!-- 弹窗：警徽设置（移交 + 警徽流） -->
      <a-modal v-model:open="jinghuiModal" title="👑 警徽设置" :footer="null" width="400px" :mask-closable="false">
        <p class="small" style="margin-bottom: 12px">
          当前警长：{{ jingHuiLabel }}｜警长出局后按警徽流移交，无人可接则警徽流失
        </p>
        <div class="flow-row">
          <span class="flow-row-label">移交警徽</span>
          <a-button v-if="!jingHuiOwner" type="dashed" block @click="openPicker('选择新警长', aliveOptions, (v) => (jingHuiOwner = v))">👤 选择新警长</a-button>
          <a-tag v-else closable color="gold" style="font-size: 14px; padding: 4px 12px" @close="jingHuiOwner = ''">{{ labelOf(jingHuiOwner) }}</a-tag>
        </div>
        <div class="flow-row">
          <span class="flow-row-label">警徽流·第一顺位</span>
          <a-button v-if="!flow1Sel" type="dashed" block @click="openPicker('选择警徽流第一顺位', aliveOptions, (v) => setFlow(1, v))">👤 选择（弹出玩家列表）</a-button>
          <a-tag v-else closable color="gold" style="font-size: 14px; padding: 4px 12px" @close="flow1Sel = ''">{{ labelOf(flow1Sel) }}</a-tag>
        </div>
        <div class="flow-row">
          <span class="flow-row-label">警徽流·第二顺位</span>
          <a-button v-if="!flow2Sel" type="dashed" block @click="openPicker('选择警徽流第二顺位', aliveOptions, (v) => setFlow(2, v))">👤 选择（弹出玩家列表）</a-button>
          <a-tag v-else closable color="blue" style="font-size: 14px; padding: 4px 12px" @close="flow2Sel = ''">{{ labelOf(flow2Sel) }}</a-tag>
        </div>
        <a-space style="width: 100%; margin-top: 14px">
          <a-button type="primary" block @click="finishJinghuiSetup">确认保存</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：女巫解药 -->
      <a-modal v-model:open="witchModal" title="💚 使用解药" :footer="null" width="380px" :mask-closable="false">
        <p class="small" style="margin-bottom: 10px">
          解药目标固定为本晚被刀者：<b class="key-name">{{ state.nightWolfKill || "尚未记录" }}</b>
        </p>
        <a-space style="width: 100%; margin-top: 12px">
          <a-button type="primary" size="large" block @click="confirmWitch">确认解救</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：通用单选玩家（置于最后，层级高于其他弹窗） -->
      <a-modal :open="!!picker" :title="picker?.title" :footer="null" width="380px" :z-index="2000" :mask-closable="false" @cancel="picker = null">
        <div class="pick-list">
          <div
            v-for="opt in picker?.options"
            :key="opt.value"
            class="pick-item"
            :class="{ active: pickerValue === opt.value }"
            @click="pickerValue = opt.value"
          >
            <span class="pick-check">{{ pickerValue === opt.value ? "●" : "○" }}</span>
            {{ opt.label }}
          </div>
        </div>
        <a-button type="primary" size="large" block style="margin-top: 14px" :disabled="!pickerValue" @click="confirmPicker">
          确认
        </a-button>
      </a-modal>

      <!-- 弹窗：警长出局，警徽去留 -->
      <a-modal v-model:open="sheriffDeathModal" title="👑 警长出局" :footer="null" width="420px" :mask-closable="false">
        <p class="small" style="margin-bottom: 10px">
          警长 {{ labelOf(deadSheriff) }} 已出局，警徽如何处理？
        </p>
        <a-space direction="vertical" style="width: 100%">
          <a-button type="primary" block @click="onSheriffAuto">
            按警徽流移交{{ state.jingHuiFlow.length ? `（${state.jingHuiFlow.map((n) => labelOf(n)).join(" → ")}）` : "" }}
          </a-button>
          <a-button block @click="onSheriffManual">手动移交警徽</a-button>
          <a-button danger block @click="onSheriffLose">警徽流失（作废）</a-button>
        </a-space>
      </a-modal>
    </a-card>

    <!-- 全局操作动画遮罩 -->
    <transition name="fx">
      <div v-if="overlay" :key="overlay.key" class="fx-overlay" :style="{ background: EFFECT_META[overlay.type]?.bg }">
        <div class="fx-inner">
          <div class="fx-emoji">{{ EFFECT_META[overlay.type]?.emoji }}</div>
          <div class="fx-label">{{ EFFECT_META[overlay.type]?.label }}</div>
          <div v-if="overlay.result" class="fx-result">{{ overlay.result }}</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* 板子配置行：可换行完整展示，不与其它标签冲突 */
.board-config-line {
  font-size: 12px;
  color: #7ec3ff;
  background: rgba(0, 122, 255, 0.1);
  border: 1px solid rgba(0, 122, 255, 0.25);
  border-radius: 8px;
  padding: 5px 10px;
  margin: 0 0 10px;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
  cursor: help;
}
.step-card {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 14px;
}
.step-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 12px;
}
.step-emoji {
  font-size: 40px;
}
.step-title {
  margin: 0;
  font-size: 20px;
}
.key-name {
  color: #ff6464;
  font-size: 18px;
  text-transform: uppercase;
}
.btn-save {
  background: #2ed573;
  border-color: #2ed573;
  color: #0f1115;
  font-weight: 700;
}
.btn-save:hover:not(:disabled) {
  background: #26c765;
  border-color: #26c765;
  color: #0f1115;
}
.btn-save:disabled {
  background: #1d2233;
  border-color: #2b3145;
  color: #555;
}
.btn-poison {
  background: rgba(150, 90, 220, 0.85);
  border-color: #9a6fe8;
  color: #fff;
  font-weight: 700;
}
.btn-poison:hover:not(:disabled) {
  background: #9a6fe8;
  border-color: #b08cff;
  color: #fff;
}
.btn-poison:disabled {
  background: #1d2233;
  border-color: #2b3145;
  color: #555;
}
.bottles {
  display: flex;
  gap: 12px;
}
.pick-list {
  max-height: 320px;
  overflow-y: auto;
}
.pick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s, border-color 0.15s;
}
.pick-item:hover {
  background: #232a3d;
}
.pick-item.active {
  background: #2ed57314;
  border-color: #2ed57355;
  color: #2ed573;
  font-weight: 600;
}
.pick-check {
  width: 18px;
  text-align: center;
  font-size: 14px;
  color: #888;
}
.wolf-pick-item {
  padding: 7px 4px;
  border-bottom: 1px solid #22283a;
}
.pick-item.active .pick-check {
  color: #2ed573;
}
.voice-sec-title {
  font-weight: 700;
  color: #ccc;
  margin-bottom: 6px;
}
.voice-row {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 8px 10px;
}
.voice-row-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.bottle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 96px;
  padding: 10px 8px;
  border-radius: 12px;
  border: 2px solid rgba(46, 213, 115, 0.6);
  background: rgba(46, 213, 115, 0.12);
  transition: opacity 0.2s;
}
.bottle-purple {
  border-color: rgba(150, 90, 220, 0.7);
  background: rgba(150, 90, 220, 0.14);
}
.bottle.used {
  opacity: 0.45;
  border-style: dashed;
}
.bottle.clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.bottle.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}
.bottle-emoji {
  font-size: 34px;
  line-height: 1;
}
.bottle-name {
  font-weight: 700;
  color: #eee;
}
.bottle-state {
  font-size: 12px;
  color: #2ed573;
  font-weight: 600;
}
.bottle-purple .bottle-state {
  color: #b28cff;
}
.bottle-state.bottle-done {
  color: #888;
}
.prophet-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: rgba(80, 50, 150, 0.25);
  border: 1px solid rgba(80, 50, 150, 0.6);
  border-radius: 12px;
  padding: 14px 18px;
}
.prophet-result-main {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}
.dawn-deaths {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.flow-night {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.flow-night-title {
  font-weight: 700;
  color: #ffa502;
  min-width: 62px;
}
.flow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.flow-row-label {
  flex: none;
  width: 62px;
  color: #888;
  font-size: 13px;
}
.flow-row .a-button,
.flow-row .a-tag {
  flex: 1;
  min-width: 0;
}
.logbox {
  max-height: 260px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.8;
  color: #aaa;
}
.fx-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.fx-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.fx-emoji {
  font-size: 96px;
  animation: fx-pop 0.6s ease-out, fx-float 1s ease-in-out 0.4s infinite alternate;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
}
.fx-label {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  animation: fx-pop 0.6s ease-out;
}
.fx-result {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 6px 18px;
  border-radius: 999px;
  animation: fx-pop 0.6s ease-out;
}
@keyframes fx-pop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  60% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes fx-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-12px);
  }
}
.fx-enter-active,
.fx-leave-active {
  transition: opacity 0.4s;
}
.fx-enter-from,
.fx-leave-to {
  opacity: 0;
}
.countdown {
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  min-width: 110px;
  color: #2ed573;
}
.countdown.warning {
  color: #ff6464;
  animation: fx-pop 0.6s ease-out infinite alternate;
}
.last-words-card {
  background: #1f2333;
  border: 1px solid #3a4260;
  border-radius: 12px;
  margin-top: 12px;
}
.last-words-title {
  font-weight: 700;
  color: #ffd666;
  margin-bottom: 10px;
}
.last-words-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.speech-timer-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 360px;
  padding: 16px;
  border-radius: 12px;
  background: #1d2233;
  border: 1px solid #333c55;
}
.speech-rand-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 360px;
  padding: 16px;
  border-radius: 12px;
  background: #2a200f;
  border: 1px dashed #ffa50288;
}
.speech-rand-title {
  font-size: 13px;
  color: #ffa502;
  font-weight: 700;
}
.speech-rand-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.speech-rand-num {
  font-size: 46px;
  font-weight: 800;
  color: #ffa502;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.speech-rand-hint {
  font-size: 13px;
  color: #bbb;
}
.floating-actions {
  position: fixed;
  right: 16px;
  bottom: 20px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fab {
  width: 48px;
  height: 48px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
@media (max-width: 720px) {
  .floating-actions {
    right: 10px;
    bottom: 14px;
  }
}
</style>
