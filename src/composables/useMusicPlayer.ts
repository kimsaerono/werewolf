import { ref, type Ref } from "vue"
import { subscribeAudioActivity } from "@/utils/audioActivity"
import {
  DEFAULT_MUSIC_VOLUME,
  getMusicTransport,
  type MusicTransport,
} from "@/utils/nightMusic"
import { DEFAULT_TRACK_ID, MUSIC_TRACKS, type MusicTrack } from "@/utils/musicTracks"

export const MUSIC_SETTINGS_KEY = "werewolf_music_settings"

export interface MusicStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface MusicPlayerOptions {
  transport: MusicTransport
  storage: MusicStorage
  tracks: MusicTrack[]
}

export interface MusicPlayer {
  tracks: MusicTrack[]
  currentTrack: Ref<MusicTrack | null>
  isPlaying: Ref<boolean>
  volume: Ref<number>
  loop: Ref<boolean>
  autoNight: Ref<boolean>
  error: Ref<string>
  play(): void
  pause(): void
  toggle(): void
  selectTrack(id: string): void
  next(): void
  previous(): void
  setVolume(value: number): void
  setLoop(value: boolean): void
  setAutoNight(value: boolean): void
  syncPhase(phase: string, finished?: boolean): void
  isDisposed(): boolean
  dispose(): void
}

interface SavedMusicSettings {
  trackId: string
  volume: number
  loop: boolean
  autoNight: boolean
}

const defaultSettings: SavedMusicSettings = {
  trackId: DEFAULT_TRACK_ID,
  volume: DEFAULT_MUSIC_VOLUME,
  loop: true,
  autoNight: true,
}

function clampVolume(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultSettings.volume
  return Math.min(1, Math.max(0, value))
}

function readSettings(storage: MusicStorage): SavedMusicSettings {
  try {
    const raw = storage.getItem(MUSIC_SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw) as Partial<SavedMusicSettings>
    if (!parsed || typeof parsed !== "object") return { ...defaultSettings }
    return {
      trackId: typeof parsed.trackId === "string" ? parsed.trackId : defaultSettings.trackId,
      volume: clampVolume(parsed.volume),
      loop: typeof parsed.loop === "boolean" ? parsed.loop : defaultSettings.loop,
      autoNight: typeof parsed.autoNight === "boolean" ? parsed.autoNight : defaultSettings.autoNight,
    }
  } catch {
    return { ...defaultSettings }
  }
}

function getBrowserStorage(): MusicStorage {
  try {
    if (typeof localStorage !== "undefined") return localStorage
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
    }
  }
  return {
    getItem: () => null,
    setItem: () => undefined,
  }
}

function findTrack(tracks: MusicTrack[], id: string): MusicTrack | null {
  return tracks.find((track) => track.id === id) ?? tracks[0] ?? null
}

export function createMusicPlayer(options: MusicPlayerOptions): MusicPlayer {
  const { transport, storage, tracks } = options
  const settings = readSettings(storage)
  const initialTrack = findTrack(tracks, settings.trackId)
  const currentTrack = ref<MusicTrack | null>(initialTrack)
  const isPlaying = ref(false)
  const volume = ref(settings.volume)
  const loop = ref(settings.loop)
  const autoNight = ref(settings.autoNight)
  const error = ref("")
  let manualIntent = false
  let currentPhase: string | null = null
  let autoPlayPending = false
  let disposed = false
  let removeUnlockListeners: (() => void) | null = null

  function persist(): void {
    const value: SavedMusicSettings = {
      trackId: currentTrack.value?.id ?? defaultSettings.trackId,
      volume: volume.value,
      loop: loop.value,
      autoNight: autoNight.value,
    }
    try {
      storage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(value))
    } catch {
      return
    }
  }

  function notifyPlaying(value: boolean): void {
    isPlaying.value = value
  }

  transport.setHooks({
    onPlayingChange: notifyPlaying,
    onEnded: () => {
      manualIntent = false
      autoPlayPending = false
    },
    onError: (message) => {
      error.value = message
      if (currentPhase === "night" && autoNight.value && !manualIntent) autoPlayPending = true
    },
  })
  transport.setVolume(settings.volume)
  transport.setLoop(settings.loop)
  if (initialTrack) transport.load(initialTrack.src)

  function playCurrent(fromStart = false): void {
    if (!currentTrack.value) {
      const fallback = tracks[0]
      if (!fallback) return
      currentTrack.value = fallback
    }
    error.value = ""
    transport.play(fromStart)
  }

  function retryAutoPlay(): void {
    if (!autoPlayPending || disposed || manualIntent || !autoNight.value || currentPhase !== "night") return
    autoPlayPending = false
    playCurrent(true)
  }

  if (typeof document !== "undefined") {
    const onGesture = () => retryAutoPlay()
    document.addEventListener("click", onGesture)
    removeUnlockListeners = () => {
      document.removeEventListener("click", onGesture)
    }
  }

  function selectTrack(id: string): void {
    if (disposed) return
    const track = findTrack(tracks, id)
    if (!track) return
    manualIntent = true
    autoPlayPending = false
    currentTrack.value = track
    transport.load(track.src)
    playCurrent()
    persist()
  }

  function next(): void {
    if (tracks.length === 0 || !currentTrack.value) {
      selectTrack(DEFAULT_TRACK_ID)
      return
    }
    const index = tracks.findIndex((track) => track.id === currentTrack.value?.id)
    selectTrack(tracks[(index + 1) % tracks.length].id)
  }

  function previous(): void {
    if (tracks.length === 0 || !currentTrack.value) {
      selectTrack(DEFAULT_TRACK_ID)
      return
    }
    const index = tracks.findIndex((track) => track.id === currentTrack.value?.id)
    selectTrack(tracks[(index - 1 + tracks.length) % tracks.length].id)
  }

  function play(): void {
    if (disposed) return
    manualIntent = true
    autoPlayPending = false
    playCurrent()
  }

  function pause(): void {
    if (disposed) return
    manualIntent = false
    autoPlayPending = false
    transport.pause()
  }

  function toggle(): void {
    if (disposed) return
    if (isPlaying.value) pause()
    else play()
  }

  function setVolume(value: number): void {
    if (disposed) return
    volume.value = clampVolume(value)
    transport.setVolume(volume.value)
    persist()
  }

  function setLoop(value: boolean): void {
    if (disposed) return
    loop.value = value
    transport.setLoop(value)
    persist()
  }

  function setAutoNight(value: boolean): void {
    if (disposed) return
    autoNight.value = value
    autoPlayPending = false
    persist()
    if (value && currentPhase === "night" && !manualIntent) playCurrent(true)
    if (!value && currentPhase === "night" && !manualIntent) transport.pause()
  }

  function syncPhase(phase: string, finished = false): void {
    if (disposed) return
    const previousPhase = currentPhase
    currentPhase = phase
    if (finished) {
      manualIntent = false
      autoPlayPending = false
      transport.stop()
      return
    }
    if (phase === "night") {
      if (previousPhase === "night" || manualIntent) return
      if (autoNight.value) playCurrent(true)
      return
    }
    autoPlayPending = false
    manualIntent = false
    transport.stop()
  }

  const unsubscribeActivity = subscribeAudioActivity((active) => {
    if (!disposed) transport.setDucking(active)
  })

  return {
    tracks,
    currentTrack,
    isPlaying,
    volume,
    loop,
    autoNight,
    error,
    play,
    pause,
    toggle,
    selectTrack,
    next,
    previous,
    setVolume,
    setLoop,
    setAutoNight,
    syncPhase,
    isDisposed: () => disposed,
    dispose() {
      if (disposed) return
      disposed = true
      autoPlayPending = false
      unsubscribeActivity()
      removeUnlockListeners?.()
      removeUnlockListeners = null
      transport.setDucking(false)
      transport.stop()
      transport.setHooks({})
    },
  }
}

let sharedPlayer: MusicPlayer | null = null

export function useMusicPlayer(): MusicPlayer {
  if (!sharedPlayer || sharedPlayer.isDisposed()) {
    sharedPlayer = createMusicPlayer({
      transport: getMusicTransport(),
      storage: getBrowserStorage(),
      tracks: MUSIC_TRACKS,
    })
  }
  return sharedPlayer
}
