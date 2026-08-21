export type VoiceStyleKey = "default" | "xiaoxin" | "conan" | "cartoon" | "robot" | "female"

export interface VoiceStyle {
  label: string
  pitch: number
  rate: number
}

export const VOICE_STYLES: Record<VoiceStyleKey, VoiceStyle> = {
  default: { label: "默认", pitch: 1, rate: 1 },
  xiaoxin: { label: "蜡笔小新（高音搞怪）", pitch: 1.7, rate: 1.2 },
  conan: { label: "柯南（冷静低沉）", pitch: 0.82, rate: 0.95 },
  cartoon: { label: "卡通（欢快）", pitch: 1.4, rate: 1.1 },
  robot: { label: "机器人（电子音）", pitch: 0.45, rate: 0.9 },
  female: { label: "女声（温柔）", pitch: 1.25, rate: 0.95 },
}

const STYLE_KEY = "werewolf_voice_style"

let voicesLoaded = false
let currentStyle: VoiceStyleKey = "default"
try {
  const k = localStorage.getItem(STYLE_KEY) as VoiceStyleKey | null
  if (k && k in VOICE_STYLES) currentStyle = k
} catch {
  /* ignore */
}

export function getVoiceStyle(): VoiceStyleKey {
  return currentStyle
}
export function setVoiceStyle(k: VoiceStyleKey): void {
  currentStyle = k in VOICE_STYLES ? k : "default"
  try {
    localStorage.setItem(STYLE_KEY, currentStyle)
  } catch {
    /* ignore */
  }
}
export function voiceStyleOptions(): { value: VoiceStyleKey; label: string }[] {
  return (Object.keys(VOICE_STYLES) as VoiceStyleKey[]).map((k) => ({
    value: k,
    label: VOICE_STYLES[k].label,
  }))
}

function ensureVoices(): void {
  if (!("speechSynthesis" in window)) return
  if (voicesLoaded) return
  voicesLoaded = true
  // 触发异步加载系统语音
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("zh-cn") && v.localService) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("zh")) ||
    null
  )
}

// ===== 播报队列：当前没播完就排队，播完再播下一条，避免头尾被吞 =====
type QueueItem = SpeechSynthesisUtterance | HTMLAudioElement
let queue: QueueItem[] = []
let playing = false
let audioEls: HTMLAudioElement[] = []

function pump(): void {
  if (playing || !queue.length) return
  const u = queue.shift()!
  playing = true
  if (u instanceof SpeechSynthesisUtterance) {
    u.onend = () => {
      playing = false
      pump()
    }
    u.onerror = () => {
      playing = false
      pump()
    }
    window.speechSynthesis.speak(u)
  } else {
    const el = u as HTMLAudioElement & { __fb?: { text: string; style?: VoiceStyleKey }; __fbDone?: boolean }
    const fallback = () => {
      if (el.__fb && !el.__fbDone) {
        el.__fbDone = true
        enqueue(el.__fb.text, el.__fb.style)
      }
      playing = false
      pump()
    }
    u.onended = () => {
      playing = false
      pump()
    }
    u.onerror = fallback
    u.play().catch(fallback)
  }
}

function enqueue(text: string, style?: VoiceStyleKey): void {
  if (!text || !("speechSynthesis" in window)) return
  ensureVoices()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = "zh-CN"
  const v = pickZhVoice()
  if (v) u.voice = v
  const s = VOICE_STYLES[style ?? currentStyle] ?? VOICE_STYLES.default
  u.pitch = s.pitch
  u.rate = s.rate
  queue.push(u)
  pump()
}

function enqueueAudio(url: string, fallbackText?: string, style?: VoiceStyleKey): void {
  const a = new Audio(url)
  a.preload = "auto"
  const el = a as HTMLAudioElement & { __fb?: { text: string; style?: VoiceStyleKey }; __fbDone?: boolean }
  if (fallbackText) el.__fb = { text: fallbackText, style }
  audioEls.push(a)
  queue.push(a)
  pump()
}

/** 去掉文本中的 emoji / 特殊 Unicode 符号，防止 TTS 读出乱码 */
function stripEmoji(text: string): string {
  // 移除 emoji + 各类 Unicode 封装符号
  // eslint-disable-next-line no-misleading-character-class
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]/gu, "").replace(/\s{2,}/g, " ").trim()
}

/** 播报一段文字（中文语音）；若正在播报则排队，播完再播，保证完整不吞字 */
export function speak(text: string, style?: VoiceStyleKey): void {
  enqueue(stripEmoji(text), style)
}

/** 逐条排队播报：一条播完再播下一条 */
export function speakQueue(texts: string[], style?: VoiceStyleKey): void {
  for (const t of texts) enqueue(stripEmoji(t), style)
}

/** 预生成音频资源（当前停用：全部走系统TTS；如需启用，填入 public/audio/<id>.mp3 映射） */
export const SPEAK_AUDIO: Record<string, string> = {}

/** 播放固定语音ID：有预生成音频则播音频（失败回退TTS），否则系统TTS */
export function speakVoice(id: string, text: string, style?: VoiceStyleKey): void {
  const url = SPEAK_AUDIO[id]
  if (url) enqueueAudio(url, text, style)
  else enqueue(text, style)
}

/** 清空队列并停止当前播报（含音频） */
export function stopSpeak(): void {
  queue = []
  playing = false
  if ("speechSynthesis" in window) window.speechSynthesis.cancel()
  audioEls.forEach((a) => {
    try {
      a.pause()
    } catch {
      /* ignore */
    }
  })
  audioEls = []
}
