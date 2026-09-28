import { beforeEach, describe, expect, it } from "bun:test"
import { __resetAudioActivityForTest, subscribeAudioActivity } from "@/utils/audioActivity"
import { __resetSpeechForTest, stopSpeak, speak } from "@/utils/speech"

beforeEach(() => {
  __resetAudioActivityForTest()
  __resetSpeechForTest()
})

class FakeUtterance {
  onend: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  lang = ""
  voice: SpeechSynthesisVoice | null = null
  pitch = 1
  rate = 1

  constructor(public text: string) {}
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay))
}

describe("语音音频活动生命周期", () => {
  it("取消后的旧 utterance 回调不会释放新 utterance 的 ducking", async () => {
    const previousWindow = globalThis.window
    const previousUtterance = globalThis.SpeechSynthesisUtterance
    const utterances: FakeUtterance[] = []
    const fakeWindow = {
      speechSynthesis: {
        getVoices: () => [],
        speak: (utterance: SpeechSynthesisUtterance) => {
          utterances.push(utterance as FakeUtterance)
        },
        cancel: () => undefined,
        onvoiceschanged: null,
      },
    }

    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow })
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeUtterance,
    })

    const activityStates: boolean[] = []
    const unsubscribe = subscribeAudioActivity((active) => activityStates.push(active))

    try {
      speak("第一条")
      speak("第二条")
      await wait(40)

      expect(utterances).toHaveLength(2)
      expect(activityStates).toEqual([true, false, true])

      utterances[0].onend?.({} as Event)
      expect(activityStates).toEqual([true, false, true])

      utterances[1].onend?.({} as Event)
      expect(activityStates).toEqual([true, false, true, false])
    } finally {
      unsubscribe()
      stopSpeak()
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
      Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
        configurable: true,
        value: previousUtterance,
      })
    }
  })
})
