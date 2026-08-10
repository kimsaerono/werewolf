<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { App as AntApp } from "ant-design-vue"
import { speak, stopSpeak, speakQueue, getVoiceStyle, setVoiceStyle, voiceStyleOptions } from "@/utils/speech"
import { playSfx, type SfxName } from "@/utils/sfx"
import { startCountdown, stopCountdown } from "@/utils/countdown"
import type { Game } from "@/types"

const { message, modal } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, activeTab, aliveList, actions, refs, sessionNo, snapshot, softStep, undo, canUndo } = props.game

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
const flowModal = ref(false)
const wwkBaoZhaSel = ref("")
const wwkTarSel = ref("")
const idiotFlip = ref(false)
const lastDawnDeaths = ref<string[]>([])

const wwkModal = ref(false)
const jinghuiModal = ref(false)
const voiceDrawer = ref(false)
const witchModal = ref<"save" | "poison" | null>(null)

// ===== 发言倒计时（白天，全局唯一计时器） =====
const speechRunning = ref(false)
const speechLeft = ref(0)
const randNo = ref<number | null>(null)
let lastBeep = 99
const SPEECH_SECONDS = 45
const speechOrderHint = computed(() => {
  if (state.jingHui) return `警长 ${state.jingHui} 左右侧发言`
  return "无警长：死左 / 死右发言（可抽随机数）"
})
function startSpeech() {
  speechRunning.value = true
  lastBeep = 99
  startCountdown(
    SPEECH_SECONDS,
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
const hunterObj = computed(() => state.players.find((p) => p.role === "猎人"))
const guardObj = computed(() => state.players.find((p) => p.role === "守卫"))
const jingHuiObj = computed(() => state.players.find((p) => p.name === state.jingHui))
const jingHuiLabel = computed(() =>
  jingHuiObj.value ? refs.playerLabel(jingHuiObj.value) : state.jingHui,
)
const hunterStatus = computed(() => {
  const h = hunterObj.value
  if (!h) return ""
  if (!h.alive && h.mark.hunterIsPoisoned) return "⛔ 被毒哑火"
  if (state.hunterShotPending) return "🔴 可开枪"
  if (state.hunterShotDone) return "✅ 已开枪"
  if (!h.alive) return "❌ 已出局"
  return "🔫 待触发"
})
const aliveCount = computed(() => state.players.filter((p) => p.alive).length)
const phaseText = computed(() =>
  state.phase === "idle" ? "未开局" : state.phase === "night" ? "🌙夜晚" : "☀️白天",
)

// ===== 对局流程进度 =====
const FLOW_EMOJI: Record<string, string> = {
  守卫守人: "🛡️",
  狼人刀人: "🌑",
  预言家验人: "🔮",
  女巫解药: "💚",
  女巫毒药: "☠️",
  天亮: "🌅",
  猎人开枪: "🔫",
  猎人弃枪: "⏭️",
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
function flowText(f: { label: string; target: string; detail: string }) {
  const base = `${FLOW_EMOJI[f.label] || "·"}${f.label}`
  if (f.label === "天亮") return base // 具体死亡情况由该晚标题后的情况标签展示
  return f.target ? `${base}(${f.target}${f.detail ? `·${f.detail}` : ""})` : f.target === "" && f.detail ? `${base}(${f.detail})` : base
}
function nightSituation(steps: { label: string; target: string; detail: string }[]): string {
  const dawn = steps.find((s) => s.label === "天亮")
  if (!dawn) return ""
  return dawn.target ? `昨夜：${dawn.target} 出局` : "平安夜"
}

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
/** 普通自爆：仅狼人（白狼王走专属自爆带人） */
const wolfPlainOptions = computed(() =>
  aliveList.value
    .filter((p) => p.role === "狼人")
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)
/** 白狼王自爆带人：白狼王选项 */
const wwkOptions = computed(() =>
  aliveList.value
    .filter((p) => p.role === "白狼王")
    .map((p) => ({ value: p.name, label: refs.playerLabel(p) })),
)

// ===== 单步向导 =====

const STEP_META: Record<string, { label: string; emoji: string }> = {
  idle: { label: "开始游戏", emoji: "🚀" },
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
  jinghui: { label: "竞选警长", emoji: "📢" },
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
  hunterOpen: "hunter_open",
  idiotOpen: "idiot_open",
  dawn: "dawn",
  hunter: "hunter",
  jinghui: "jinghui",
  vote: "vote",
  night: "night_start",
}
/** 步骤完成后的闭眼语音 */
const STEP_CLOSE: Record<string, string> = {
  guard: "guard_close",
  wolf: "wolf_close",
  prophet: "prophet_close",
  witch: "witch_close",
  knight: "knight_close",
  hunterOpen: "hunter_close",
  idiotOpen: "idiot_close",
}
const VOICE_LABEL: Record<string, string> = {
  night_start: "进入夜晚（天黑请闭眼）",
  wolf: "狼人睁眼",
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
    const aliveWolf = state.players.some((p) => p.alive && refs.isWolfRole(p.role))
    // 首夜神职睁眼确认身份
    if (state.round <= 1 && hasHunter.value && !uiDone.value.hunterOpen) ks.push("hunterOpen")
    if (state.round <= 1 && hasIdiot.value && !uiDone.value.idiotOpen) ks.push("idiotOpen")
    if (state.round <= 1 && hasKnight.value && !uiDone.value.knight) ks.push("knight")
    if (hasGuard.value && !state.nightSteps.guard && !uiDone.value.guard) ks.push("guard")
    if (aliveWolf && !uiDone.value.wolf) ks.push("wolf")
    if (hasProphet.value && !uiDone.value.prophet) ks.push("prophet")
    if (hasWitch.value && !state.nightSteps.witch && !uiDone.value.witch) ks.push("witch")
    if (ks.length === 0) ks.push("dawn")
    return ks
  }
  if (state.skipVote) return ["night"]
  const ks: string[] = []
  if (state.hunterShotPending) ks.push("hunter")
  if (state.round <= 1 && !uiDone.value.jinghui) ks.push("jinghui")
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
      }, 2200)
    }
  },
)
watch(
  () => state.phase,
  (ph) => {
    if (ph === "night") lastDawnDeaths.value = []
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
  effect("wolf", "howl", victim ? `狼人刀：${refs.playerLabel(victim)}` : `狼人刀：${v}`)
}
function doWolfClose() {
  markDoneStep("wolf")
  playVoice("wolf_close")
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
function openFlowModal() {
  flow1Sel.value = state.jingHuiFlow[0] || ""
  flow2Sel.value = state.jingHuiFlow[1] || ""
  flowModal.value = true
}
function finishFlow() {
  actions.setJingHuiFlow([flow1Sel.value, flow2Sel.value].filter(Boolean))
  flowModal.value = false
  message.success("警徽流已保存")
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
  jinghuiModal.value = true
}
function onSheriffLose() {
  sheriffDeathModal.value = false
  actions.loseJingHui()
  message.warning("警徽流失")
}
function doJingHuiTransfer() {
  snapshot()
  const owner = jingHuiOwner.value
  const ownerP = owner ? state.players.find((x) => x.name === owner) : null
  actions.setJingHui(owner, false)
  jinghuiModal.value = false
  if (ownerP && refs.isWolfRole(ownerP.role)) {
    message.success(`⚠️ ${refs.playerLabel(ownerP)} 狼人悍跳拿到警徽！`)
  } else {
    message.success("警徽已移交")
  }
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
        else markDone("vote")
      },
    })
    return
  }
  const err = actions.finishVote(v, false)
  if (err) return message.error(err)
  markDone("vote")
  if (state.hunterShotPending) playVoice("hunter")
  checkSheriffDeath()
}
function doWolfBaoZha(v: string) {
  snapshot()
  const err = actions.wolfBaoZha(v)
  if (err) return message.error(err)
  message.success("狼人自爆，直接进入黑夜")
  effect("explode", "explode")
  playVoice("explode")
  checkSheriffDeath()
}
function doWWKBoom() {
  snapshot()
  const err = actions.wolfKingBaoZha(wwkBaoZhaSel.value, wwkTarSel.value)
  if (err) return message.error(err)
  wwkBaoZhaSel.value = ""
  wwkTarSel.value = ""
  wwkModal.value = false
  message.success("白狼王自爆带人，直接进入黑夜")
  effect("explode", "explode")
  playVoice("wwk_boom")
  checkSheriffDeath()
}
function doKnightDuel(v: string) {
  snapshot()
  const tarRole = v ? state.players.find((x) => x.name === v)?.role : ""
  const err = actions.knightDuel(v)
  if (err) return message.error(err)
  message.success("骑士决斗完成")
  effect("knight", "sword")
  if (refs.isWolfRole(tarRole || "")) playVoice("knight_duel_wolf")
  else playVoice("knight_duel_good")
  checkSheriffDeath()
}
function doDawn() {
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
  // 全屏过场动画同时展示玩家信息（平安夜 / 死亡名单）
  effect("dawn", "rooster", lastDawnDeaths.value.length ? `昨夜死亡：${deathInfo}` : "平安夜")
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
      effect("death", "death")
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
  if (enteringNight && state.voiceEnabled) playVoice("night_start")
}

function openNextGame() {
  actions.startNextGame()
  message.success(`第 ${sessionNo.value} 局已开启，请配置板子与选人`)
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
      <a-flex :justify="'space-between'" :wrap="'wrap'" :gap="12" style="margin-bottom: 12px">
        <a-space :wrap="true">
          <a-tag color="geekblue">阶段：{{ phaseText }}</a-tag>
          <a-tag color="purple">第 {{ state.round }} 晚</a-tag>
          <a-tag :color="aliveCount > 0 ? 'green' : 'error'">存活 {{ aliveCount }} / {{ state.players.length }}</a-tag>
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
          <a-button type="primary" size="large" style="height: 48px; min-width: 220px" @click="doFlow">🌙 进入夜晚</a-button>
        </div>

        <!-- 守卫 -->
        <div v-else-if="currentStep === 'guard'" class="step-body">
          <div class="step-emoji">🛡️</div>
          <h3 class="step-title">守卫守人</h3>
          <p class="small" style="text-align: center">
            守卫：{{ guardObj ? refs.playerLabel(guardObj) : "-" }}
            <template v-if="state.guardLastTarget">｜上局守护 {{ state.guardLastTarget }}（不能同守）</template>
          </p>
          <a-button type="primary" size="large" @click="openPicker('选择守护对象', aliveOptions, (v) => doGuard(v))">🛡️ 确认守人</a-button>
          <a-button type="text" style="margin-top: 12px" @click="confirmSkip('本轮不守？', '守卫本晚不守护任何人，确认后进入下一步', () => markDoneStep('guard'))">本轮不守</a-button>
        </div>

        <!-- 狼人刀人 -->
        <div v-else-if="currentStep === 'wolf'" class="step-body">
          <div class="step-emoji">🌑</div>
          <h3 class="step-title">狼人刀人</h3>
          <p class="small" style="text-align: center">选中狼人即自动标记为自刀</p>
          <a-button v-if="!state.nightWolfKill" danger size="large" @click="openPicker('选择被刀对象', aliveOptions, (v) => doWolfKill(v))">🌑 确认刀人</a-button>
          <div v-else class="prophet-result">
            <div class="prophet-result-main">
              🌑 已刀：{{ (() => { const v = state.players.find((x) => x.name === state.nightWolfKill); return v ? refs.playerLabel(v) : state.nightWolfKill })() }}
            </div>
            <a-button type="primary" danger @click="doWolfClose">已确认狼人闭眼</a-button>
          </div>
        </div>

        <!-- 预言家 -->
        <div v-else-if="currentStep === 'prophet'" class="step-body">
          <div class="step-emoji">🔮</div>
          <h3 class="step-title">预言家验人</h3>
          <a-button v-if="!checkResult" type="primary" size="large" @click="openPicker('选择查验对象', [{ value: refs.NO_CHECK, label: '🙅 不验' }, ...aliveOptions], (v) => doProphetCheck(v))">🔮 确认查验</a-button>
          <div v-else class="prophet-result">
            <div class="prophet-result-main">{{ checkResult }}</div>
            <a-button type="primary" danger @click="doProphetClose">已告知预言家，闭眼</a-button>
          </div>
        </div>

        <!-- 女巫 -->
        <div v-else-if="currentStep === 'witch'" class="step-body">
          <div class="step-emoji">🧪</div>
          <h3 class="step-title">女巫操作</h3>
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

          <div v-if="state.nightWitchSave" class="small">💚 已解救：{{ state.nightWitchSave }}</div>
          <div v-if="state.nightWitchPoison" class="small">☠️ 已毒杀：{{ state.nightWitchPoison }}</div>
        </div>

        <!-- 猎人睁眼（首夜） -->
        <div v-else-if="currentStep === 'hunterOpen'" class="step-body">
          <div class="step-emoji">🔫</div>
          <h3 class="step-title">猎人睁眼（首夜）</h3>
          <p class="small" style="text-align: center">确认你的枪状态，白天/夜里按规则触发开枪</p>
          <a-button type="primary" @click="doHunterOpen">确认身份，闭眼</a-button>
        </div>

        <!-- 白痴睁眼（首夜） -->
        <div v-else-if="currentStep === 'idiotOpen'" class="step-body">
          <div class="step-emoji">🙊</div>
          <h3 class="step-title">白痴睁眼（首夜）</h3>
          <p class="small" style="text-align: center">确认身份，继续闭眼摸鱼</p>
          <a-button type="primary" @click="doIdiotOpen">确认身份，闭眼</a-button>
        </div>

        <!-- 骑士睁眼（首夜） -->
        <div v-else-if="currentStep === 'knight'" class="step-body">
          <div class="step-emoji">⚔️</div>
          <h3 class="step-title">骑士睁眼（首夜）</h3>
          <p class="small" style="text-align: center">确认身份后闭眼，白天可用「骑士决斗」</p>
          <a-button type="primary" @click="doKnightOpen">确认身份，闭眼</a-button>
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

        <!-- 竞选警长 -->
        <div v-else-if="currentStep === 'jinghui'" class="step-body">
          <div class="step-emoji">📢</div>
          <h3 class="step-title">竞选警长</h3>
          <a-button type="primary" size="large" @click="openPicker('选择警长', aliveOptions, (v) => doJingHui(v))">📢 设置警长</a-button>
          <a-button type="text" style="margin-top: 12px" @click="confirmSkip('本轮不竞选？', '本局不竞选警长，确认后进入下一步', () => markDoneStep('jinghui'))">本轮不竞选</a-button>
        </div>

        <!-- 发言环节 -->
        <div v-else-if="currentStep === 'speech'" class="step-body">
          <div class="step-emoji">🗣️</div>
          <h3 class="step-title">发言环节</h3>
          <p class="small" style="text-align: center">{{ speechOrderHint }}（计时 {{ SPEECH_SECONDS }}s）</p>
          <a-space :wrap="true" :align="'center'">
            <span class="countdown" :class="{ warning: speechRunning && speechLeft <= 7 }">
              {{ speechRunning ? `${speechLeft}s` : "待开始" }}
            </span>
            <a-button type="primary" size="large" @click="speechRunning ? stopSpeech() : startSpeech()">
              {{ speechRunning ? "⏹ 停止 / 重置" : "▶ 开始计时" }}
            </a-button>
          </a-space>
          <a-space v-if="!state.jingHui" :wrap="true">
            <a-button size="small" @click="rollRand">🎲 按人数抽随机发言</a-button>
            <a-tag v-if="randNo" color="orange">抽中 {{ randNo }} 号</a-tag>
          </a-space>
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

      <!-- 白天插入操作（白狼王/骑士决斗；狼人自爆/警徽移交已放右侧悬浮） -->
      <a-flex
        v-if="state.phase === 'day' && !state.skipVote && !state.finished"
        :wrap="'wrap'"
        :gap="10"
        style="margin-top: 12px"
      >
        <a-button v-if="hasWWK" danger @click="wwkModal = true">👑💥 白狼王自爆带人</a-button>
        <a-button v-if="hasKnight" @click="openPicker('选择决斗对象', aliveOptions, (v) => doKnightDuel(v))">⚔️ 骑士决斗</a-button>
      </a-flex>

      <!-- 对局流程进度 -->
      <a-card v-if="flowGroups.length" type="inner" title="📊 对局流程进度（含每晚具体情况）" size="small" style="margin-top: 12px">
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
      </a-card>

      <!-- 存活状态 -->
      <a-card type="inner" title="全部玩家存活状态" size="small" style="margin-top: 12px">
        <div class="alive-list">
          <a-tag
            v-for="p in state.players"
            :key="p.name"
            :color="p.alive ? 'green' : 'default'"
            :style="{ opacity: p.alive ? 1 : 0.5 }"
            class="alive-tag"
            :class="{ 'sheriff-tag': p.name === state.jingHui }"
          >
            <span v-if="p.name === state.jingHui" style="color:#ffd666">👑</span>{{ refs.playerLabel(p) }}{{ p.mark.idiotFlipped ? "🙊" : "" }} {{ p.alive ? "✅" : "❌" }}
          </a-tag>
        </div>
      </a-card>

      <!-- 语音配置 + 日志 -->
      <a-collapse style="margin-top: 12px">
        <a-collapse-panel key="log" header="📜 对局日志">
          <div class="logbox">
            <div v-for="(l, i) in state.globalLog" :key="i">{{ l }}</div>
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

      <!-- 悬浮按钮：自爆 + 警徽流 + 警徽移交 + 回退一步 + 重播当前步 + 语音配置 -->
      <div class="floating-actions">
        <a-tooltip v-if="state.phase === 'day' && !state.skipVote && !state.finished" title="狼人自爆（跳过本日投票，直接入夜）">
          <a-button class="fab" type="primary" danger shape="circle" size="large" @click="openPicker('选择自爆狼人', wolfPlainOptions, (v) => doWolfBaoZha(v))">💥</a-button>
        </a-tooltip>
        <a-tooltip v-if="state.jingHui && !state.finished" title="设置警徽流（出局后移交顺序）">
          <a-button class="fab" type="warning" shape="circle" size="large" @click="openFlowModal">👑</a-button>
        </a-tooltip>
        <a-tooltip v-if="state.phase === 'day' && state.round > 1 && !state.skipVote && !state.finished" title="警徽移交">
          <a-button class="fab" type="warning" shape="circle" size="large" @click="jinghuiModal = true">📢</a-button>
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

      <!-- 弹窗：白狼王自爆带人 -->
      <a-modal v-model:open="wwkModal" title="👑💥 白狼王自爆带人" :footer="null" width="380px">
        <p class="small">白狼王出局并带走一个目标，直接进入黑夜</p>
        <a-space direction="vertical" style="width: 100%">
          <a-select v-model:value="wwkBaoZhaSel" placeholder="选择白狼王" :options="wwkOptions" style="width: 100%" />
          <a-select v-model:value="wwkTarSel" placeholder="选择带走目标" :options="aliveOptions" style="width: 100%" />
          <a-button danger block @click="doWWKBoom">确认自爆带人</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：警徽移交 -->
      <a-modal v-model:open="jinghuiModal" title="📢 警徽移交" :footer="null" width="380px">
        <p class="small">警长死亡后在此重新指定即完成移交</p>
        <a-space :wrap="true" style="width: 100%">
          <a-select v-model:value="jingHuiOwner" placeholder="选择新警长" allow-clear :options="aliveOptions" style="min-width: 180px; flex: 1" />
          <a-button type="primary" @click="doJingHuiTransfer">确认移交</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：女巫解药 -->
      <a-modal v-model:open="witchModal" title="💚 使用解药" :footer="null" width="380px">
        <p class="small" style="margin-bottom: 10px">
          解药目标固定为本晚被刀者：<b class="key-name">{{ state.nightWolfKill || "尚未记录" }}</b>
        </p>
        <a-space style="width: 100%; margin-top: 12px">
          <a-button type="primary" size="large" block @click="confirmWitch">确认解救</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：通用单选玩家 -->
      <a-modal :open="!!picker" :title="picker?.title" :footer="null" width="380px" @cancel="picker = null">
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

      <!-- 弹窗：警徽流 -->
      <a-modal v-model:open="flowModal" title="👑 设置警徽流" :footer="null" width="400px">
        <p class="small" style="margin-bottom: 10px">
          当前警长：{{ jingHuiLabel }}｜出局后按此顺序移交警徽；无人可接则警徽流失
        </p>
        <a-space direction="vertical" style="width: 100%">
          <a-select v-model:value="flow1Sel" placeholder="警徽流 1（第一顺位）" allow-clear :options="aliveOptions" style="width: 100%" />
          <a-select v-model:value="flow2Sel" placeholder="警徽流 2（第二顺位）" allow-clear :options="aliveOptions" style="width: 100%" />
        </a-space>
        <a-space style="width: 100%; margin-top: 14px">
          <a-button type="primary" block @click="finishFlow">保存警徽流</a-button>
        </a-space>
      </a-modal>

      <!-- 弹窗：警长出局，警徽去留 -->
      <a-modal v-model:open="sheriffDeathModal" title="👑 警长出局" :footer="null" width="420px">
        <p class="small" style="margin-bottom: 10px">
          警长 {{ deadSheriff }} 已出局，警徽如何处理？
        </p>
        <a-space direction="vertical" style="width: 100%">
          <a-button type="primary" block @click="onSheriffAuto">
            按警徽流移交{{ state.jingHuiFlow.length ? `（${state.jingHuiFlow.join(" → ")}）` : "" }}
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
.alive-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 720px) {
  /* 移动端竖屏：按座位号分左右两列，小号左、大号右 */
  .alive-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 6px;
    row-gap: 6px;
  }
  .alive-tag {
    margin: 0;
  }
}
.alive-tag.sheriff-tag {
  border: 1px solid #ffd666;
  box-shadow: 0 0 6px rgba(255, 214, 102, 0.35);
}
</style>
