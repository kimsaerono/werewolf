import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { DEFAULT_TRACK_ID, MUSIC_TRACKS } from "./musicTracks"

describe("Pixabay 曲库", () => {
  it("包含十首唯一且本地文件存在的欢快纯音乐", () => {
    expect(MUSIC_TRACKS.map((track) => track.id)).toEqual([
      "pixabay-510767",
      "pixabay-499483",
      "pixabay-174247",
      "pixabay-187119",
      "pixabay-313326",
      "pixabay-468332",
      "pixabay-595510",
      "pixabay-583255",
      "pixabay-579511",
      "pixabay-308504",
    ])
    expect(new Set(MUSIC_TRACKS.map((track) => track.id)).size).toBe(10)
    expect(DEFAULT_TRACK_ID).toBe("pixabay-510767")

    for (const track of MUSIC_TRACKS) {
      expect(track.src.startsWith("audio/music/")).toBe(true)
      expect(existsSync(resolve(process.cwd(), "public", track.src))).toBe(true)
    }
  })
})
