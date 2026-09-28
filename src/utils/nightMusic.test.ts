import { describe, expect, it } from "bun:test"
import {
  createMusicTransport,
  DEFAULT_MUSIC_VOLUME,
  DUCKING_VOLUME_FACTOR,
  getMusicTransport,
  type MusicTransport,
} from "./nightMusic"

class FakeAudio {
  loop = false
  preload = ""
  currentTime = 0
  playCount = 0
  pauseCount = 0
  readonly volumeLog: number[] = []
  private currentVolume = 1
  private readonly listeners = new Map<string, Set<(event: Event) => void>>()

  constructor(public src: string) {}

  get volume(): number {
    return this.currentVolume
  }

  set volume(value: number) {
    this.currentVolume = value
    this.volumeLog.push(value)
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

  firstListener(type: string): ((event: Event) => void) | undefined {
    return [...(this.listeners.get(type) ?? [])][0]
  }
}

class DeferredAudio extends FakeAudio {
  readonly playRequests: Array<(reason: unknown) => void> = []

  override play(): Promise<void> {
    this.playCount += 1
    return new Promise((_, reject) => this.playRequests.push(reject))
  }
}

function setup(hooks: Parameters<typeof createMusicTransport>[1] = {}) {
  const instances: FakeAudio[] = []
  const transport = createMusicTransport((src) => {
    const audio = new FakeAudio(src)
    instances.push(audio)
    return audio as unknown as HTMLAudioElement
  }, hooks)
  return { transport, instances, audio: () => instances[0] }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("音乐传输单实例", () => {
  it("加载默认夜晚曲目后播放：单实例、循环、低音量", () => {
    const { transport, instances, audio } = setup()

    transport.load("audio/night.mp3")
    transport.play()

    expect(instances).toHaveLength(1)
    expect(audio().src).toBe("audio/night.mp3")
    expect(audio().loop).toBe(true)
    expect(audio().preload).toBe("auto")
    expect(audio().volume).toBe(DEFAULT_MUSIC_VOLUME)
    expect(audio().playCount).toBe(1)
    expect(transport.state()).toMatchObject({ playing: true, loop: true, src: "audio/night.mp3" })
  })

  it("旧播放请求失败不会导致重开重复调用", async () => {
    const audio = new DeferredAudio("audio/night.mp3")
    const playing: boolean[] = []
    const transport = createMusicTransport(() => audio as unknown as HTMLAudioElement, {
      onPlayingChange: (value) => playing.push(value),
    })
    transport.load("audio/night.mp3")

    transport.play()
    transport.stop()
    transport.play()
    audio.playRequests[0](new Error("AbortError"))
    await flush()
    transport.play()

    expect(audio.playCount).toBe(2)
    expect(transport.state().playing).toBe(true)
    expect(playing).toEqual([true, false, true])
  })

  it("停止后再次播放复用同一个音频", () => {
    const { transport, instances, audio } = setup()
    transport.load("audio/night.mp3")
    transport.play()

    transport.stop()
    expect(audio().pauseCount).toBe(1)
    expect(audio().currentTime).toBe(0)
    expect(transport.state().playing).toBe(false)

    transport.play()
    expect(instances).toHaveLength(1)
    expect(audio().playCount).toBe(2)
  })

  it("切换曲目仍然复用同一个音频元素且不自动播放", () => {
    const { transport, instances, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()

    transport.load("audio/two.mp3")

    expect(instances).toHaveLength(1)
    expect(audio().src).toBe("audio/two.mp3")
    expect(audio().playCount).toBe(1)
    expect(transport.state()).toMatchObject({ playing: false, src: "audio/two.mp3" })

    transport.play()
    expect(audio().playCount).toBe(2)
  })

  it("重复加载同一曲目不重建元素也不打断进度", () => {
    const { transport, instances, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    audio().currentTime = 12

    transport.load("audio/one.mp3")

    expect(instances).toHaveLength(1)
    expect(audio().currentTime).toBe(12)
    expect(transport.state().playing).toBe(true)
  })

  it("play(fromStart) 把播放位置归零", () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    audio().currentTime = 88
    transport.stop()

    transport.play(true)

    expect(audio().currentTime).toBe(0)
    expect(audio().playCount).toBe(2)
  })
})

describe("音量、ducking 与淡变", () => {
  it("用户音量立即生效并夹逼到 0..1", () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()

    transport.setVolume(0.8)
    expect(audio().volume).toBe(0.8)

    transport.setVolume(2)
    expect(audio().volume).toBe(1)
    expect(transport.state().userVolume).toBe(1)

    transport.setVolume(-1)
    expect(audio().volume).toBe(0)
  })

  it("ducking 压低音量并在解除后恢复用户音量", () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    transport.setVolume(0.8)

    transport.setDucking(true)
    expect(transport.state().ducking).toBe(true)
    expect(audio().volume).toBeCloseTo(0.8 * DUCKING_VOLUME_FACTOR, 6)

    transport.setDucking(false)
    expect(transport.state().ducking).toBe(false)
    expect(audio().volume).toBe(0.8)
  })

  it("fadeTo 分步渐变到目标音量", async () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    transport.setVolume(0.8)
    audio().volumeLog.length = 0

    transport.fadeTo(0, 48)
    expect(audio().volume).toBe(0.8)

    await new Promise((resolve) => setTimeout(resolve, 160))

    expect(audio().volume).toBe(0)
    expect(audio().volumeLog.length).toBeGreaterThan(2)
  })

  it("淡变过程中设置新音量会取消淡变", async () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    transport.setVolume(0.8)

    transport.fadeTo(0, 400)
    transport.setVolume(0.5)
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(audio().volume).toBe(0.5)
  })

  it("ducking 支持带淡变地压低音量", async () => {
    const { transport, audio } = setup()
    transport.load("audio/one.mp3")
    transport.play()
    transport.setVolume(0.8)

    transport.setDucking(true, 32)
    expect(audio().volume).toBe(0.8)

    await new Promise((resolve) => setTimeout(resolve, 160))

    expect(audio().volume).toBeCloseTo(0.8 * DUCKING_VOLUME_FACTOR, 6)
  })
})

describe("状态与错误回调", () => {
  it("循环关闭时播放结束上报停止", () => {
    const playing: boolean[] = []
    const { transport, audio } = setup({ onPlayingChange: (value) => playing.push(value) })
    transport.load("audio/one.mp3")
    transport.setLoop(false)
    transport.play()

    audio().dispatch("ended")

    expect(playing).toEqual([true, false])
    expect(transport.state().playing).toBe(false)
  })

  it("当前播放请求失败触发错误回调并复位播放状态", async () => {
    const errors: string[] = []
    const playing: boolean[] = []
    const audio = new DeferredAudio("audio/one.mp3")
    const transport = createMusicTransport(() => audio as unknown as HTMLAudioElement, {
      onError: (message) => errors.push(message),
      onPlayingChange: (value) => playing.push(value),
    })
    transport.load("audio/one.mp3")
    transport.play()

    audio.playRequests[0](new Error("decode failed"))
    await flush()

    expect(errors).toEqual(["decode failed"])
    expect(playing).toEqual([true, false])
    expect(transport.state().playing).toBe(false)
  })

  it("AbortError 不上报为错误", async () => {
    const errors: string[] = []
    const audio = new DeferredAudio("audio/one.mp3")
    const transport = createMusicTransport(() => audio as unknown as HTMLAudioElement, {
      onError: (message) => errors.push(message),
    })
    transport.load("audio/one.mp3")
    transport.play()

    const aborted = new Error("aborted")
    aborted.name = "AbortError"
    audio.playRequests[0](aborted)
    await flush()

    expect(errors).toEqual([])
  })

  it("媒体元素 error 事件进入错误回调并复位播放状态", () => {
    const errors: string[] = []
    const { transport, audio } = setup({ onError: (message) => errors.push(message) })
    transport.load("audio/one.mp3")
    transport.play()

    audio().dispatch("error")
    transport.play()

    expect(errors).toEqual(["音频加载失败"])
    expect(transport.state().playing).toBe(true)
    expect(audio().playCount).toBe(2)
  })

  it("切换曲目后忽略旧音源的错误回调", () => {
    const errors: string[] = []
    const { transport, audio } = setup({ onError: (message) => errors.push(message) })
    transport.load("audio/one.mp3")
    transport.play()
    const staleError = audio().firstListener("error")

    transport.load("audio/two.mp3")
    staleError?.({ type: "error" } as Event)

    expect(errors).toEqual([])
    expect(transport.state().src).toBe("audio/two.mp3")
  })

  it("setHooks 可以替换回调", async () => {
    const audio = new DeferredAudio("audio/one.mp3")
    const transport: MusicTransport = createMusicTransport(() => audio as unknown as HTMLAudioElement)
    const errors: string[] = []
    transport.setHooks({ onError: (message) => errors.push(message) })
    transport.load("audio/one.mp3")
    transport.play()

    audio.playRequests[0](new Error("boom"))
    await flush()

    expect(errors).toEqual(["boom"])
  })
})

describe("共享实例", () => {
  it("getMusicTransport 始终返回同一个单例", () => {
    expect(getMusicTransport()).toBe(getMusicTransport())
  })

  it("无浏览器环境时 stop 不抛错", () => {
    expect(() => getMusicTransport().stop()).not.toThrow()
  })
})
