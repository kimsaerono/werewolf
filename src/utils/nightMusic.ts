export const DEFAULT_MUSIC_VOLUME = 0.18
export const DUCKING_VOLUME_FACTOR = 1 / 3
const FADE_STEP_MS = 16

export interface MusicTransportState {
  src: string
  playing: boolean
  loop: boolean
  ducking: boolean
  userVolume: number
  volume: number
}

export interface MusicTransportHooks {
  onPlayingChange?: (playing: boolean) => void
  onEnded?: () => void
  onError?: (message: string) => void
}

export interface MusicTransport {
  load(src: string): void
  play(fromStart?: boolean): void
  pause(): void
  stop(): void
  setLoop(loop: boolean): void
  setVolume(volume: number): void
  setDucking(ducking: boolean, fadeMs?: number): void
  fadeTo(volume: number, durationMs: number): void
  setHooks(hooks: MusicTransportHooks): void
  state(): MusicTransportState
}

interface MediaHandlers {
  ended: (event: Event) => void
  error: (event: Event) => void
}

function createBrowserAudio(src: string): HTMLAudioElement {
  if (typeof Audio === "undefined" || typeof document === "undefined") throw new Error("Audio is unavailable")
  return new Audio(new URL(src, document.baseURI).toString())
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "音频播放失败"
}

export function createMusicTransport(
  createAudio: (src: string) => HTMLAudioElement = createBrowserAudio,
  hooks: MusicTransportHooks = {},
): MusicTransport {
  let audio: HTMLAudioElement | null = null
  let src = ""
  let playing = false
  let loop = true
  let ducking = false
  let userVolume = DEFAULT_MUSIC_VOLUME
  let appliedVolume = userVolume
  let playAttempt = 0
  let sourceGeneration = 0
  let fadeTimer: ReturnType<typeof setTimeout> | null = null
  let activeHooks = hooks
  let mediaHandlers: MediaHandlers | null = null

  function failPlayback(message: string): void {
    playAttempt += 1
    setPlaying(false)
    activeHooks.onError?.(message)
  }

  const onEnded = () => {
    if (loop) return
    setPlaying(false)
    activeHooks.onEnded?.()
  }
  const onMediaError = () => failPlayback("音频加载失败")

  function bindMediaHandlers(element: HTMLAudioElement): void {
    if (mediaHandlers) {
      element.removeEventListener("ended", mediaHandlers.ended)
      element.removeEventListener("error", mediaHandlers.error)
    }
    const generation = sourceGeneration
    const nextHandlers: MediaHandlers = {
      ended: () => {
        if (generation !== sourceGeneration || !playing) return
        onEnded()
      },
      error: () => {
        if (generation !== sourceGeneration) return
        onMediaError()
      },
    }
    mediaHandlers = nextHandlers
    element.addEventListener("ended", nextHandlers.ended)
    element.addEventListener("error", nextHandlers.error)
  }

  function targetVolume(): number {
    return ducking ? userVolume * DUCKING_VOLUME_FACTOR : userVolume
  }

  function applyVolume(): void {
    appliedVolume = targetVolume()
    if (audio) audio.volume = appliedVolume
  }

  function cancelFade(): void {
    if (fadeTimer === null) return
    clearTimeout(fadeTimer)
    fadeTimer = null
  }

  function ensureAudio(): HTMLAudioElement | null {
    if (audio) return audio
    try {
      const created = createAudio(src)
      created.preload = "auto"
      created.loop = loop
      audio = created
      bindMediaHandlers(created)
      applyVolume()
      return created
    } catch {
      return null
    }
  }

  function setPlaying(next: boolean): void {
    if (playing === next) return
    playing = next
    activeHooks.onPlayingChange?.(next)
  }

  function fadeTo(volume: number, durationMs: number): void {
    cancelFade()
    const target = clamp01(volume)
    if (!audio || !(durationMs > 0)) {
      appliedVolume = target
      if (audio) audio.volume = target
      return
    }
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
    const from = appliedVolume
    let step = 0
    const tick = () => {
      step += 1
      appliedVolume = from + (target - from) * (step / steps)
      if (audio) audio.volume = appliedVolume
      if (step < steps) fadeTimer = setTimeout(tick, FADE_STEP_MS)
      else fadeTimer = null
    }
    fadeTimer = setTimeout(tick, FADE_STEP_MS)
  }

  function fadeToTarget(durationMs: number): void {
    const target = targetVolume()
    if (durationMs > 0) fadeTo(target, durationMs)
    else {
      cancelFade()
      appliedVolume = target
      if (audio) audio.volume = target
    }
  }

  return {
    load(next: string) {
      if (!next || next === src) return
      src = next
      sourceGeneration += 1
      if (!audio) return
      playAttempt += 1
      audio.src = next
      audio.pause()
      setPlaying(false)
      bindMediaHandlers(audio)
    },
    play(fromStart = false) {
      const element = ensureAudio()
      if (!element) return
      if (fromStart) element.currentTime = 0
      if (playing) return
      const attempt = ++playAttempt
      setPlaying(true)
      void element.play().catch((reason: unknown) => {
        if (attempt !== playAttempt) return
        playAttempt += 1
        setPlaying(false)
        if (!isAbort(reason)) activeHooks.onError?.(describeError(reason))
      })
    },
    pause() {
      if (!audio) {
        setPlaying(false)
        return
      }
      playAttempt += 1
      audio.pause()
      setPlaying(false)
    },
    stop() {
      if (!audio) {
        setPlaying(false)
        return
      }
      playAttempt += 1
      cancelFade()
      audio.pause()
      audio.currentTime = 0
      setPlaying(false)
    },
    setLoop(next: boolean) {
      loop = next
      if (audio) audio.loop = next
    },
    setVolume(volume: number) {
      userVolume = clamp01(volume)
      cancelFade()
      appliedVolume = targetVolume()
      if (audio) audio.volume = appliedVolume
    },
    setDucking(next: boolean, fadeMs = 0) {
      ducking = next
      fadeToTarget(fadeMs)
    },
    fadeTo,
    setHooks(next: MusicTransportHooks) {
      activeHooks = next
    },
    state() {
      return { src, playing, loop, ducking, userVolume, volume: appliedVolume }
    },
  }
}

const sharedTransport = createMusicTransport()

export function getMusicTransport(): MusicTransport {
  return sharedTransport
}
