import { describe, expect, it } from "bun:test"
import { createHonors, toggleHonor } from "./honor"

describe("荣誉选择", () => {
  it("点选 / 再点取消", () => {
    const h = createHonors()
    toggleHonor(h, "mvp", "P1")
    expect(h.mvp).toBe("P1")
    toggleHonor(h, "mvp", "P1")
    expect(h.mvp).toBe("")
  })

  it("同一荣誉选别人会替换", () => {
    const h = createHonors()
    toggleHonor(h, "mvp", "P1")
    toggleHonor(h, "mvp", "P2")
    expect(h.mvp).toBe("P2")
  })

  it("同一玩家不能同时占两个荣誉", () => {
    const h = createHonors()
    toggleHonor(h, "mvp", "P1")
    toggleHonor(h, "svp", "P1")
    expect(h.mvp).toBe("")
    expect(h.svp).toBe("P1")
  })

  it("三项互不影响", () => {
    const h = createHonors()
    toggleHonor(h, "mvp", "P1")
    toggleHonor(h, "svp", "P2")
    toggleHonor(h, "beiguo", "P3")
    expect(h).toEqual({ mvp: "P1", svp: "P2", beiguo: "P3" })
  })
})
