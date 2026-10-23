import { beforeEach, describe, expect, it } from "bun:test"
import { __resetAudioActivityForTest, beginAudioActivity } from "@/utils/audioActivity"
import { createMusicTransport, DUCKING_VOLUME_FACTOR } from "@/utils/nightMusic"
import type { MusicTrack } from "@/utils/musicTracks"
import { createMusicPlayer, MUSIC_SETTINGS_KEY, type MusicStorage } from "./useMusicPlayer"

class FakeAudio {
  loop = false
  preload = ""
  currentTime = 0
  playCount = 0
  pauseCount = 0
  private currentVolume = 1
  private readonly listeners = new Map<string, Set<(event: Event) => void>>()

  constructor(public src: string) {}

  get volume(): number {
    return this.currentVolume
  }

  set volume(value: number) {
    this.currentVolume = value
  }

  play(): Promise<void> {
    this.playCount += 1
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCount += 1
  }

  addEventListener(type: string, handler: (event: Event) => void): void {
    const group = this.listeners.get(type) ?? new Set()
    group.add(handler)
    this.listeners.set(type, group)
  }

  removeEventListener(type: string, handler: (event: Event) => void): void {
    this.listeners.get(type)?.delete(handler)
  }

  dispatch(type: string): void {
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler({ type } as Event)
  }
}

class DeferredAudio extends FakeAudio {
  readonly playRequests: Array<(reason: unknown) => void> = []

  override play(): Promise<void> {
    this.playCount += 1
    return new Promise((_, reject) => this.playRequests.push(reject))
  }
}

class MemoryStorage implements MusicStorage {
  private readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const TEST_TRACKS: MusicTrack[] = [
  { id: "sumo", title: "Sumo 相扑", src: "audio/sumo.mp3" },
  { id: "wolf", title: "月下狼嚎", src: "audio/wolf.mp3" },
]

function setup(options: { tracks?: MusicTrack[]; storage?: MemoryStorage; deferred?: boolean } = {}) {
  const instances: FakeAudio[] = []
  const transport = createMusicTransport((src) => {
    const audio = options.deferred ? new DeferredAudio(src) : new FakeAudio(src)
    instances.push(audio)
    return audio as unknown as HTMLAudioElement
  })
  const storage = options.storage ?? new MemoryStorage()
  const player = createMusicPlayer({ transport, storage, tracks: options.tracks ?? TEST_TRACKS })
  return { player, transport, storage, instances, audio: () => instances[0] }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  __resetAudioActivityForTest()
})

describe("播放列表与手动操作", () => {
  it("选择歌曲立即切换并播放，且只创建一个音频元素", () => {
    const { player, instances, audio } = setup()

    player.selectTrack("sumo")
    player.selectTrack("wolf")

    expect(player.currentTrack.value?.id).toBe("wolf")
    expect(player.isPlaying.value).toBe(true)
    expect(instances).toHaveLength(1)
    expect(audio().src).toBe("audio/wolf.mp3")
    expect(audio().playCount).toBe(2)
  })

  it("next/previous 在播放列表内循环切换并播放", () => {
    const { player, audio } = setup()
    player.selectTrack("sumo")

    player.next()
    expect(player.currentTrack.value?.id).toBe("wolf")
    expect(audio().src).toBe("audio/wolf.mp3")

    player.next()
    expect(player.currentTrack.value?.id).toBe("sumo")

    player.previous()
    expect(player.currentTrack.value?.id).toBe("wolf")
    expect(audio().playCount).toBe(4)
    expect(player.isPlaying.value).toBe(true)
  })

  it("未知歌曲 id 回落第一首", () => {
    const { player } = setup()

    player.selectTrack("not-exists")

    expect(player.currentTrack.value?.id).toBe("sumo")
  })

  it("toggle 在播放与暂停之间切换", () => {
    const { player, audio } = setup()

    player.toggle()
    expect(player.isPlaying.value).toBe(true)
    expect(audio().playCount).toBe(1)

    player.toggle()
    expect(player.isPlaying.value).toBe(false)
    expect(audio().pauseCount).toBe(1)
  })

  it("音量与循环设置写入 transport", () => {
    const { player, transport, audio } = setup()
    player.selectTrack("sumo")

    player.setVolume(0.5)
    player.setLoop(false)

    expect(player.volume.value).toBe(0.5)
    expect(transport.state().userVolume).toBe(0.5)
    expect(player.loop.value).toBe(false)
    expect(audio().loop).toBe(false)
  })

  it("播放失败写入 error 状态", async () => {
    const { player, audio } = setup({ deferred: true })

    player.selectTrack("sumo")
    ;(audio() as unknown as DeferredAudio).playRequests[0](new Error("网络中断"))
    await flush()

    expect(player.error.value).toBe("网络中断")
  })
})

describe("阶段联动规则", () => {
  it("夜晚且 autoNight 时从头播放，同一夜晚不重复打断", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)

    player.syncPhase("night")
    expect(audio().playCount).toBe(1)
    expect(player.isPlaying.value).toBe(true)

    audio().currentTime = 30
    player.syncPhase("night")
    expect(audio().playCount).toBe(1)
    expect(audio().currentTime).toBe(30)

    player.syncPhase("day")
    player.syncPhase("night")
    expect(audio().playCount).toBe(2)
    expect(audio().currentTime).toBe(0)
  })

  it("autoNight 关闭时夜晚不自动播放", () => {
    const { player } = setup()
    player.setAutoNight(false)

    player.syncPhase("night")

    expect(player.isPlaying.value).toBe(false)
  })

  it("自动播放被浏览器拒绝后，首次用户手势会重试", async () => {
    const previousDocument = globalThis.document
    const fakeDocument = new EventTarget()
    Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })

    try {
      const { player, audio } = setup({ deferred: true })
      player.syncPhase("night")
      ;(audio() as unknown as DeferredAudio).playRequests[0](new DOMException("需要用户手势", "NotAllowedError"))
      await flush()

      expect(player.error.value).toBe("需要用户手势")
      expect(audio().playCount).toBe(1)

      fakeDocument.dispatchEvent(new Event("click"))
      expect(audio().playCount).toBe(2)
      player.dispose()
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument })
    }
  })

  it("用户点击播放按钮不会被全局重试反向暂停", async () => {
    const previousDocument = globalThis.document
    const fakeDocument = new EventTarget()
    Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })

    try {
      const { player, audio } = setup({ deferred: true })
      player.syncPhase("night")
      ;(audio() as unknown as DeferredAudio).playRequests[0](new DOMException("需要用户手势", "NotAllowedError"))
      await flush()

      fakeDocument.dispatchEvent(new Event("pointerdown"))
      player.toggle()
      fakeDocument.dispatchEvent(new Event("click"))

      expect(audio().playCount).toBe(2)
      expect(player.isPlaying.value).toBe(true)
      player.dispose()
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument })
    }
  })

  it("白天在没有手动播放时停止", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)
    player.syncPhase("night")
    audio().currentTime = 8

    player.syncPhase("day")

    expect(audio().currentTime).toBe(0)
    expect(player.isPlaying.value).toBe(false)
  })

  it("天亮无条件停止，即使处于手动播放", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)
    player.syncPhase("night")

    player.play()
    audio().currentTime = 12

    player.syncPhase("day")
    expect(player.isPlaying.value).toBe(false)
    expect(audio().currentTime).toBe(0)
  })

  it("白天手动播放持续到夜晚不重置进度，天亮停止", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)
    player.syncPhase("night")
    player.syncPhase("day")

    player.play()
    audio().currentTime = 12

    player.syncPhase("night")
    expect(audio().playCount).toBe(2)
    expect(audio().currentTime).toBe(12)

    player.syncPhase("day")
    expect(player.isPlaying.value).toBe(false)
    expect(audio().currentTime).toBe(0)
  })

  it("天亮停止后下一夜仍自动播放", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)
    player.syncPhase("night")
    player.play()

    player.syncPhase("day")
    player.syncPhase("night")

    expect(audio().playCount).toBe(2)
    expect(player.isPlaying.value).toBe(true)
  })

  it("非循环自然播放结束后释放手动意图，下一夜恢复自动播放", () => {
    const { player, audio } = setup()
    player.selectTrack("sumo")
    player.setLoop(false)
    audio().dispatch("ended")

    player.syncPhase("day")
    player.syncPhase("night")

    expect(audio().playCount).toBe(2)
    expect(player.isPlaying.value).toBe(true)
  })

  it("手动暂停后当前夜晚保持暂停，下一次夜晚恢复自动播放", () => {
    const { player, audio } = setup()
    player.setAutoNight(true)
    player.syncPhase("night")

    player.pause()
    expect(audio().pauseCount).toBe(1)

    player.syncPhase("night")
    expect(audio().playCount).toBe(1)
    expect(player.isPlaying.value).toBe(false)

    player.syncPhase("day")
    player.syncPhase("night")
    expect(audio().playCount).toBe(2)
    expect(player.isPlaying.value).toBe(true)
  })

  it("对局结束后停止音乐并清除手动意图", () => {
    const { player, audio } = setup()
    player.play()

    player.syncPhase("night", true)

    expect(audio().pauseCount).toBe(1)
    expect(audio().currentTime).toBe(0)
    expect(player.isPlaying.value).toBe(false)

    player.syncPhase("day")
    expect(audio().playCount).toBe(1)
  })

  it("重新开启 autoNight 时夜晚立即开播", () => {
    const { player, audio } = setup()
    player.setAutoNight(false)
    player.syncPhase("night")
    expect(player.isPlaying.value).toBe(false)

    player.setAutoNight(true)

    expect(audio().playCount).toBe(1)
  })
})

describe("偏好持久化", () => {
  it("用户设置写入 localStorage 并在新建播放器时恢复", () => {
    const { player, storage } = setup()
    player.selectTrack("wolf")
    player.setVolume(0.42)
    player.setLoop(false)
    player.setAutoNight(false)

    const raw = storage.getItem(MUSIC_SETTINGS_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({ trackId: "wolf", volume: 0.42, loop: false, autoNight: false })

    const restored = setup({ storage })
    expect(restored.player.currentTrack.value?.id).toBe("wolf")
    expect(restored.player.volume.value).toBe(0.42)
    expect(restored.player.loop.value).toBe(false)
    expect(restored.player.autoNight.value).toBe(false)
    expect(restored.player.isPlaying.value).toBe(false)
    expect(restored.instances).toHaveLength(0)
  })

  it("损坏的存储内容回落默认值且不抛错", () => {
    const broken = new MemoryStorage()
    broken.setItem(MUSIC_SETTINGS_KEY, "{oops")

    const withBroken = setup({ storage: broken })
    expect(withBroken.player.currentTrack.value?.id).toBe("sumo")
    expect(withBroken.player.volume.value).toBeGreaterThan(0)
    expect(withBroken.player.loop.value).toBe(true)
    expect(withBroken.player.autoNight.value).toBe(true)

    const wrongTypes = new MemoryStorage()
    wrongTypes.setItem(MUSIC_SETTINGS_KEY, JSON.stringify({ trackId: 1, volume: "loud", loop: "yes" }))

    const withWrongTypes = setup({ storage: wrongTypes })
    expect(withWrongTypes.player.currentTrack.value?.id).toBe("sumo")
    expect(withWrongTypes.player.volume.value).toBeGreaterThan(0)
    expect(withWrongTypes.player.loop.value).toBe(true)
    expect(withWrongTypes.player.autoNight.value).toBe(true)
  })
})

describe("音频活动 ducking", () => {
  it("其他音频活动期间压低音乐音量", () => {
    const { player, transport, audio } = setup()
    player.selectTrack("sumo")
    player.setVolume(0.8)

    const release = beginAudioActivity()
    expect(transport.state().ducking).toBe(true)
    expect(audio().volume).toBeCloseTo(0.8 * DUCKING_VOLUME_FACTOR, 6)

    release()
    expect(transport.state().ducking).toBe(false)
    expect(audio().volume).toBe(0.8)
  })

  it("dispose 后不再接收 ducking", () => {
    const { transport } = setup()
    const player = createMusicPlayer({ transport, storage: new MemoryStorage(), tracks: TEST_TRACKS })

    player.dispose()
    beginAudioActivity()()

    expect(player.isDisposed()).toBe(true)
    expect(transport.state().playing).toBe(false)
    expect(transport.state().ducking).toBe(false)
  })
})
