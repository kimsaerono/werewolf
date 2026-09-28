import { beforeEach, describe, expect, it } from "bun:test"
import { __resetAudioActivityForTest, beginAudioActivity, subscribeAudioActivity } from "./audioActivity"

beforeEach(() => {
  __resetAudioActivityForTest()
})

describe("audio activity", () => {
  it("notifies only when active state changes", () => {
    const states: boolean[] = []
    const unsubscribe = subscribeAudioActivity((active) => states.push(active))

    expect(states).toEqual([])

    const release = beginAudioActivity()
    release()
    release()

    expect(states).toEqual([true, false])
    unsubscribe()
  })

  it("replays active state to a new subscriber", () => {
    const release = beginAudioActivity()
    const states: boolean[] = []
    const unsubscribe = subscribeAudioActivity((active) => states.push(active))

    expect(states).toEqual([true])
    release()
    expect(states).toEqual([true, false])
    unsubscribe()
  })

  it("stays active until overlapping activities are released", () => {
    const states: boolean[] = []
    const unsubscribe = subscribeAudioActivity((active) => states.push(active))
    const releaseFirst = beginAudioActivity()
    const releaseSecond = beginAudioActivity()

    releaseFirst()
    releaseFirst()
    expect(states).toEqual([true])

    releaseSecond()
    expect(states).toEqual([true, false])
    unsubscribe()
  })

  it("can unsubscribe a listener", () => {
    const states: boolean[] = []
    const unsubscribe = subscribeAudioActivity((active) => states.push(active))
    const release = beginAudioActivity()

    unsubscribe()
    release()

    expect(states).toEqual([true])
  })
})
