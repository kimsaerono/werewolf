// Web Audio 代码生成的提示音，无需任何音频素材
let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.2,
) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.05)
}

function noise(c: AudioContext, start: number, dur: number, vol = 0.3) {
  const n = c.createBufferSource()
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  n.buffer = buf
  const g = c.createGain()
  g.gain.setValueAtTime(vol, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
  const f = c.createBiquadFilter()
  f.type = "lowpass"
  f.frequency.value = 1200
  n.connect(f)
  f.connect(g)
  g.connect(c.destination)
  n.start(c.currentTime + start)
}

export type SfxName =
  | "howl" // 狼人刀人：啊呜～
  | "magic" // 预言家验人
  | "guard" // 守卫
  | "witch" // 女巫
  | "gunshot" // 猎人开枪
  | "boing" // 白痴翻牌（搞笑）
  | "rooster" // 天亮鸡叫
  | "explode" // 自爆
  | "sword" // 骑士决斗
  | "beep" // 倒计时滴
  | "ding" // 时间到
  | "death" // 出局

export function playSfx(name: SfxName): void {
  const c = ac()
  if (!c) return
  const t = 0
  switch (name) {
    case "howl": // 啊呜～（下滑狼嚎）
      tone(c, 220, t, 0.5, "sawtooth", 0.18)
      tone(c, 180, t + 0.25, 0.6, "sawtooth", 0.16)
      tone(c, 130, t + 0.5, 0.7, "sawtooth", 0.14)
      break
    case "magic": // 神秘琶音
      tone(c, 880, t, 0.2, "sine", 0.14)
      tone(c, 1108, t + 0.12, 0.2, "sine", 0.13)
      tone(c, 1318, t + 0.24, 0.35, "sine", 0.12)
      break
    case "guard": // 厚重防护
      tone(c, 196, t, 0.3, "triangle", 0.18)
      tone(c, 247, t + 0.1, 0.3, "triangle", 0.16)
      break
    case "witch": // 神秘药水咕嘟
      tone(c, 440, t, 0.15, "sine", 0.15)
      tone(c, 349, t + 0.15, 0.15, "sine", 0.15)
      tone(c, 262, t + 0.3, 0.2, "sine", 0.15)
      break
    case "gunshot": // 枪声
      noise(c, t, 0.3, 0.5)
      tone(c, 120, t, 0.25, "square", 0.2)
      break
    case "boing": // 搞笑的弹簧
      tone(c, 523, t, 0.4, "square", 0.14)
      tone(c, 392, t + 0.2, 0.5, "square", 0.13)
      tone(c, 262, t + 0.45, 0.6, "square", 0.12)
      break
    case "rooster": // 鸡叫（升调两声）
      tone(c, 392, t, 0.15, "square", 0.16)
      tone(c, 523, t + 0.16, 0.15, "square", 0.16)
      tone(c, 659, t + 0.32, 0.2, "square", 0.15)
      break
    case "explode": // 爆炸
      noise(c, t, 0.5, 0.5)
      tone(c, 90, t, 0.4, "sawtooth", 0.25)
      break
    case "sword": // 剑出鞘
      tone(c, 1567, t, 0.1, "triangle", 0.12)
      tone(c, 2093, t + 0.08, 0.2, "triangle", 0.12)
      break
    case "beep":
      tone(c, 880, t, 0.12, "sine", 0.15)
      break
    case "ding":
      tone(c, 880, t, 0.15, "sine", 0.18)
      tone(c, 1108, t + 0.16, 0.3, "sine", 0.18)
      break
    case "death": // 出局低沉音
      tone(c, 330, t, 0.3, "sine", 0.18)
      tone(c, 262, t + 0.18, 0.4, "sine", 0.16)
      break
  }
}
