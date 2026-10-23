import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"

/**
 * 新角色界面文案护栏（轻量、无组件测试框架）。
 *
 * 直接读 GamePanel.vue 源码做正则断言：抓住「逻辑已实现但界面漏接关键提示」这类
 * 静默回归。与 roles/parity.test.ts 的护栏手法一致。
 */
const PANEL = readFileSync(new URL("../../components/GamePanel.vue", import.meta.url), "utf8")

describe("新角色界面护栏：关键提示文案存在", () => {
  it("狼人被噩梦之影恐惧 → 提示 + 空刀按钮", () => {
    expect(PANEL).toMatch(/狼队被噩梦之影恐惧，本夜无法刀人/)
    expect(PANEL).toMatch(/确认空刀（被恐惧）/)
  })

  it("隐狼带刀 → 面板提示其已获得刀人能力", () => {
    expect(PANEL).toMatch(/隐狼已获得刀人能力（其余狼出局）/)
  })

  it("狼人空刀按钮文案存在", () => {
    expect(PANEL).toMatch(/空刀（不刀人）/)
  })

  it("噩梦之影说明：恐惧狼阵营/神职分别生效", () => {
    expect(PANEL).toMatch(/恐惧狼阵营 → 该阵营当晚无法刀人/)
    expect(PANEL).toMatch(/恐惧神职 → 其技能当晚失效/)
  })

  it("血月封印/被恐占位提示（猎魔人、摄梦人面板）", () => {
    expect(PANEL).toMatch(/血月封印：本夜神职技能失效/)
    expect(PANEL).toMatch(/猎魔人被恐惧，本晚不能行动/)
    expect(PANEL).toMatch(/摄梦人被恐惧，本晚不能行动/)
  })

  it("炸弹人面板说明：放逐引爆/全票独赢", () => {
    expect(PANEL).toMatch(/被放逐时引爆炸弹，炸死票选你的玩家/)
    expect(PANEL).toMatch(/若被全票放逐则独赢/)
  })

  it("炸弹人放逐引爆播报", () => {
    expect(PANEL).toMatch(/炸弹人放逐/)
    expect(PANEL).toMatch(/炸弹爆炸/)
  })
})

describe("新角色界面护栏：wolfNoOne 计算属性（隐狼带刀时不隐藏狼环节）", () => {
  it("wolfNoOne 依赖 packWolfQuota 与隐狼带刀状态", () => {
    const m = PANEL.match(/const wolfNoOne = computed\(([\s\S]*?)\n\)/)
    expect(m, "未找到 wolfNoOne computed").toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/hasKnife/)
    expect(body).toMatch(/packWolfAlive/)
  })

  it("自爆选项禁选狼美人/石像鬼/恶灵骑士", () => {
    expect(PANEL).toMatch(/def\.id === "狼美人"\) return "不能自爆"/)
    expect(PANEL).toMatch(/def\.id === "石像鬼"\) return "不能自爆"/)
    expect(PANEL).toMatch(/def\.id === "恶灵骑士"\) return "不能自爆"/)
  })

  it("自爆入口只在警上/放逐发言阶段（投票前）显示", () => {
    expect(PANEL).toMatch(/currentStep === 'jinghui' \|\| \(state\.phase === 'day' && currentStep === 'speech'\)/)
  })

  it("支持多选拾取器（炸弹人票选）", () => {
    expect(PANEL).toMatch(/openMultiPicker/)
  })
})

describe("新角色界面护栏：语音映射 key 覆盖", () => {
  const VOICE_KEYS = [
    "nightmare",
    "nightmare_close",
    "hiddenWolf",
    "hiddenWolf_close",
    "hunterWolf",
    "hunterWolf_close",
    "dreamer",
    "dreamer_close",
    "wild_child",
    "wild_child_close",
    "bomber_open",
    "bomber_close",
    "blood_seal",
    "bomber_boom",
  ]

  it("游戏内语音文案映射包含全部新角色 key", () => {
    for (const k of VOICE_KEYS) {
      expect(PANEL, `缺少语音映射 ${k}`).toMatch(new RegExp(`\\b${k}\\s*:`))
    }
  })
})

const ROLE_HELP = readFileSync(new URL("../../components/RoleHelp.vue", import.meta.url), "utf8")
const RECORD_PANEL = readFileSync(new URL("../../components/RecordPanel.vue", import.meta.url), "utf8")
const SEAT_BOARD = readFileSync(new URL("../../components/SeatBoard.vue", import.meta.url), "utf8")

describe("第三方/野孩子链型 · 界面与文档护栏", () => {
  it("首夜石像鬼在炸弹人之后（实际被挪到所有夜间步骤末尾）", () => {
    expect(ROLE_HELP).toContain("炸弹人睁眼→石像鬼查验")
    expect(ROLE_HELP).not.toContain("守卫→石像鬼→隐狼睁眼")
  })

  it("狼人帮助：仅 WW 不可互刀，WG 狼恋人可被刀", () => {
    expect(ROLE_HELP).toContain("仅狼狼恋（WW）双狼情侣不可互刀")
    expect(ROLE_HELP).toContain("人狼恋（WG）的狼恋人可被狼队刀")
  })

  it("野孩子/丘比特帮助：说明 GG→WG 成立、WG→WW 解散", () => {
    expect(ROLE_HELP).toContain("GG→WG 第三方成立")
    expect(ROLE_HELP).toContain("WG→WW 第三方解散")
  })

  it("丘比特帮助：好人恋人/丘比特被技能命中的计分口径", () => {
    expect(ROLE_HELP).toContain("好人恋人/丘比特被女巫毒/猎人带按好人-1，炸弹炸 0")
  })

  it("隐狼/石像鬼帮助：隐狼首夜获知狼人号码，石像鬼分配前置", () => {
    expect(ROLE_HELP).toContain("隐狼睁眼（获知狼人号码）")
    expect(ROLE_HELP).toContain("石像鬼分配")
    expect(ROLE_HELP).toContain("单方面得知本局所有狼人阵营号码")
  })

  it("历史记录优先用结算时固化的 chain，且炸弹人标第三方", () => {
    expect(RECORD_PANEL).toContain("h.chain")
    expect(RECORD_PANEL).toContain("第三方·")
  })

  it("座位牌给第三方阵营（含炸弹人）紫色描边", () => {
    expect(SEAT_BOARD).toContain("third-camp")
    expect(SEAT_BOARD).toContain("炸弹人")
  })
})

describe("炸弹人/隐狼 · 新流程护栏", () => {
  it("炸弹人全屏过场在选投票者之前，且有 bomber 动画配置", () => {
    expect(PANEL).toContain("bomber: {")
    expect(PANEL).toMatch(/effect\("bomber"/)
    expect(PANEL).toContain("startBombLastWordsQueue")
  })

  it("炸弹人遗言队列：炸弹人先、直接炸死者升序、结束再判胜负", () => {
    expect(PANEL).toContain("lastWordsQueue")
    expect(PANEL).toContain("nextLastWords")
    expect(PANEL).toContain("finishBombLastWords")
    expect(PANEL).toContain("state.bombLastWordsPending")
  })

  it("隐狼首夜全屏名单 + 手动关闭", () => {
    expect(PANEL).toContain("hiddenWolfReveal")
    expect(PANEL).toContain("showHiddenWolfList")
    expect(PANEL).toContain("本局狼人阵营")
    expect(PANEL).toContain("知道了")
  })

  it("石像鬼分配步骤提前、查验步骤保留", () => {
    expect(PANEL).toContain("gargoyleAssign")
    expect(PANEL).toContain("石像鬼分配")
  })
})
