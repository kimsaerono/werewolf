import { afterEach, describe, expect, it } from "bun:test"
import { themeRoleEmoji, themeRoleName, themeRoleShort, themeText, useTheme } from "./useTheme"

const { setTheme } = useTheme()

afterEach(() => setTheme("classic"))

describe("万圣节主题角色别称", () => {
  it("万圣节主题返回别称，经典主题返回原名", () => {
    setTheme("halloween")
    expect(themeRoleName("预言家")).toBe("灵媒巫师（预言家）")
    expect(themeRoleName("女巫")).toBe("暗夜巫婆（女巫）")
    expect(themeRoleName("猎人")).toBe("亡灵猎手（猎人）")
    expect(themeRoleName("守卫")).toBe("古堡守灵人（守卫）")
    expect(themeRoleShort("预言家")).toBe("灵媒")
    expect(themeRoleEmoji("守卫")).toBe("⚰️")

    setTheme("classic")
    expect(themeRoleName("预言家")).toBe("预言家")
    expect(themeRoleShort("预言家")).toBe("预")
    expect(themeRoleEmoji("守卫")).toBe("🛡️")
  })

  it("语音里的趣味代称也替换为万圣节称呼", () => {
    setTheme("halloween")
    expect(themeText("算命大仙请睁眼")).toBe("灵媒巫师请睁眼")
    expect(themeText("药罐子女巫请睁眼")).toBe("暗夜巫婆请睁眼")
    expect(themeText("夜班保镖上线")).toBe("古堡守灵人上线")
    expect(themeText("枪哥，猎枪已上膛")).toBe("亡灵猎手，猎枪已上膛")
  })

  it("themeText 只替换显示/播报文案，不改动其他角色", () => {
    setTheme("halloween")
    expect(themeText("预言家验人，守卫守人；狼人睁眼")).toBe(
      "灵媒巫师验人，古堡守灵人守夜；狼人睁眼",
    )
    setTheme("classic")
    expect(themeText("预言家验人")).toBe("预言家验人")
  })
})
