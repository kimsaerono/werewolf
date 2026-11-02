/**
 * 步骤展示元数据（key → 标签/图标）。
 *
 * 这是「界面认识哪些步骤」的登记表：任何会出现在流程里的步骤 key，
 * 都必须在这里登记，否则步骤卡片/进度条拿不到标签。
 * parity 测试会断言：所有角色派生出的夜间步骤 key 都在此处登记（防漏接）。
 */
export interface StepMeta {
  label: string
  emoji: string
}

export const STEP_META: Record<string, StepMeta> = {
  idle: { label: "开始游戏", emoji: "🚀" },
  cupid: { label: "丘比特连人", emoji: "💘" },
  wildChild: { label: "野孩子选榜样", emoji: "🌱" },
  loversMeet: { label: "情侣认亲", emoji: "💑" },
  guard: { label: "守卫守人", emoji: "🛡️" },
  gargoyleAssign: { label: "石像鬼分配", emoji: "🗿" },
  hiddenWolf: { label: "隐狼睁眼", emoji: "🐺" },
  nightmare: { label: "噩梦之影恐惧", emoji: "😱" },
  wolf: { label: "狼人刀人", emoji: "🌑" },
  gargoyle: { label: "石像鬼", emoji: "🗿" },
  charm: { label: "狼美人魅惑", emoji: "🌹" },
  hunterWolf: { label: "猎魔人狩猎", emoji: "🗡️" },
  dreamer: { label: "摄梦人入梦", emoji: "💭" },
  prophet: { label: "预言家验人", emoji: "🔮" },
  witch: { label: "女巫操作", emoji: "🧪" },
  gravekeeper: { label: "守墓人验尸", emoji: "🪦" },
  knight: { label: "骑士睁眼", emoji: "⚔️" },
  knight_close: { label: "骑士闭眼", emoji: "⚔️" },
  hunterOpen: { label: "猎人睁眼", emoji: "🔫" },
  idiotOpen: { label: "白痴睁眼", emoji: "🙊" },
  bomberOpen: { label: "炸弹人睁眼", emoji: "💣" },
  dawn: { label: "天亮", emoji: "🌅" },
  hunter: { label: "猎人开枪", emoji: "🔫" },
  wolfkingShot: { label: "狼王开枪", emoji: "🔫" },
  jinghui: { label: "竞选警长", emoji: "📢" },
  prophetReport: { label: "报验人", emoji: "🔮" },
  speech: { label: "发言环节", emoji: "🗣️" },
  vote: { label: "放逐投票", emoji: "🗳️" },
  night: { label: "进入夜晚", emoji: "🌙" },
  end: { label: "本局结束", emoji: "🏁" },
}
