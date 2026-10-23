<script setup lang="ts">
import { computed, ref } from "vue"
import { roleAvatar } from "@/assets/roles"
import { ROLE_EMOJI } from "@/game/logic"

const props = defineProps<{ roles: string[] }>()

const open = ref(false)

/** 每个角色：玩法 + 计分（与 recalcScore 最新逻辑一致） */
const ROLE_INFO: Record<string, { play: string; score: string }> = {
  狼人: {
    play: "每晚共同选一人刀杀；仅狼狼恋（WW）双狼情侣不可互刀，人狼恋（WG）的狼恋人可被狼队刀；白天可自爆跳过投票，自爆时若为警长则警徽流失",
    score: "胜利+3｜狼群全员存活：3狼各+0.5、4+狼各+1（不含石像鬼/隐狼/黑化野孩子）｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  白狼王: {
    play: "同狼人，白天可自爆带走一人（被带走者不能开枪），跳过投票；被投票/毒死/殉情时不能带走人",
    score: "胜利+3｜狼群全员存活：3狼各+0.5、4+狼各+1（不含石像鬼/隐狼/黑化野孩子）｜悍跳拿警徽+0.5｜自刀骗解药+0.5｜自爆带走带药女巫/守卫/未开技能骑士+0.5",
  },
  狼王: {
    play: "同狼人，被刀死或被放逐投票出局可开枪带走一人；被毒死、殉情、白狼王带走时不能开枪",
    score: "胜利+3｜狼群全员存活：3狼各+0.5、4+狼各+1（不含石像鬼/隐狼/黑化野孩子）｜枪带神牌+0.5、枪带狼-1｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  狼美人: {
    play: "同狼人，每晚魅惑一人（不可连续两晚同一人）；被票/枪杀/炸弹引爆出局时被魅惑者殉情（殉情者不能开技能）。禁止被刀、禁止自爆；被毒/决斗/被刀出局不触发殉情",
    score: "胜利+3｜狼群全员存活：3狼各+0.5、4+狼各+1（不含石像鬼/隐狼/黑化野孩子）｜悍跳拿警徽+0.5",
  },
  恶灵骑士: {
    play: "同狼人（参与狼人刀人），不能被狼人选为刀人目标；不能自爆。免疫夜间所有伤害（毒药/猎魔人狩猎/摄梦连梦都杀不死，反伤用掉后仍免疫），白天可被猎人开枪或放逐出局。一次性反伤：预言家验他或女巫毒他 → 释放技能的神职天亮出局（同夜只反弹预言家，解药救不回）；反伤只能触发一次，之后不再反伤",
    score: "胜利+3｜反伤触发每次+1｜吸引查验未反伤+0.5｜吸引毒药未反伤+0.5",
  },
  石像鬼: {
    play: "狼人阵营但不与普通狼见面：首夜先提前确认身份（保证预言家验人正确），查验在首夜末尾；每晚独立查验一名存活玩家的完整身份；不参与狼人刀人、不能自爆；可被狼刀/毒/放逐。除石像鬼外狼阵营全灭后，获得夜间刀人能力（保留验人）；预言家验其为狼",
    score: "狼胜且存活到终局+0.5｜胜利+3",
  },
  隐狼: {
    play: "狼人阵营但不与狼群见面，首夜在狼人商议刀法后单独睁眼，单方面得知本局所有狼人阵营号码（狼人不知道隐狼）。预言家验其为好人（金水）；除隐狼外狼阵营全灭后，获得夜间刀人能力（并入狼人环节）；不参与狼人刀人，不参与狼营确认组；可正常自爆",
    score: "胜利+3",
  },
  噩梦之影: {
    play: "狼人阵营·普通带刀狼。每晚恐惧一人：恐惧狼阵营 → 狼队当晚空刀；恐惧神职 → 其技能当晚失效；恐惧自己/平民 → 无效果。不能恐惧已出局玩家",
    score: "恐惧狼队（空刀）-1｜恐惧神职（预言家/女巫/猎魔人/摄梦人）+0.5｜胜利+3",
  },
  血月使徒: {
    play: "狼人阵营·普通带刀狼。只能在【警上发言 / 放逐发言（投票前）】自爆：翻牌自爆，当天结束并跳过投票，当夜全部神职技能失效（警上自爆封印顺延到下一夜）。被投票放逐后不能再自爆；若血月是场上最后一只狼，被放逐时延迟出局：当晚仍可行动/刀人，天亮才死亡。自爆与放逐延迟二选一，不能叠加",
    score: "自爆封印神职+0.5｜胜利+3",
  },
  猎魔人: {
    play: "好人阵营·神职。每晚狩猎一人，天亮结算：目标是狼则其出局；是好人则猎魔人反噬出局。免疫女巫毒（毒药消耗但无效）；首夜认人不行动；反伤不触发。与摄梦人交互：目标被摄梦保护时只挡狩猎击杀、不挡反噬；猎魔人自身反噬不被梦免（猎到好人照样出局）；好人目标本身不会被狩猎击杀",
    score: "狩猎戳中狼+0.5｜戳错好人-0.5｜神职胜利+3",
  },
  摄梦人: {
    play: "好人阵营·神职。每晚使一人入梦成为梦游者（不能梦自己），梦游者免疫外来夜间伤害（狼刀/毒药/猎魔人狩猎击杀；不挡恶灵骑士反伤/猎魔人自身反噬）；连续两晚入同一人梦境，该玩家被梦杀出局（无视守卫/解药）。摄梦人夜间死亡时，当夜梦游者殉情（不开枪）；白天被放逐不触发殉情",
    score: "连梦击杀狼+1｜连梦击杀好人-1｜神职胜利+3",
  },
  守墓人: {
    play: "好人阵营·神职。首夜不触发；第二夜起每晚得知上一白天被投票放逐者属于好人还是狼人阵营（被刀/毒/枪/殉情不产生信息；无人被放逐则无信息）；死亡后失效",
    score: "神职胜利+3",
  },
  预言家: {
    play: "每晚验一人，知晓其为狼人或好人阵营",
    score: "拿警徽+0.5｜验狼+0.5/只（不封顶）｜每晚未验人-0.5",
  },
  女巫: {
    play: "解药仅首夜中刀时可自救，之后哪怕解药仍在也不能自救，只能救他人；毒药首夜即可使用；同夜解药/毒药最多使用一瓶；被首杀时跳过女巫环节（奶穿）",
    score: "毒狼+1、毒好人-1｜救对好人+0.5",
  },
  猎人: {
    play: "被狼刀死或被放逐投票出局可开枪带走一人；被毒死、殉情、白狼王带走时不能开枪",
    score: "带狼+1、带好人-1",
  },
  守卫: {
    play: "每晚守一人免刀，不能连续两晚守同一人；同守同救则该玩家死亡（奶穿）",
    score: "守中+0.5｜同守同救-0.5",
  },
  骑士: {
    play: "每局一次决斗，白天翻牌决斗：戳中狼人则狼死骑士存活，戳错则骑士死亡",
    score: "决斗戳狼+1、戳错-1",
  },
  白痴: {
    play: "被放逐时翻牌免死，之后失去投票权；底牌始终是神职（屠神需杀掉，翻牌不转平民）",
    score: "神职胜利+3（狼王枪带白痴按神牌+0.5）",
  },
  平民: {
    play: "无特殊技能，靠发言和投票",
    score: "胜利+2",
  },
  野孩子: {
    play: "好人阵营·平民。首夜选择一名玩家作为榜样（不能选自己）；榜样死亡后，野孩子黑化为狼人阵营（计算出狼、查验为查杀）。下一晚起加入狼群：与狼同睁眼、互相认识、共享一刀；其他狼全灭后仍保留狼刀，可单独刀人；可正常自爆。不计入狼群全员存活加成；野孩子先死/与榜样同夜出局则不变身。若野孩子是情侣，黑化瞬间链型动态重算：GG→WG 第三方成立（丘比特+两情侣）；WG→WW 第三方解散，丘比特变回神",
    score: "黑化变身+1｜狼胜+3（不计狼群存活加成）｜未黑化按平民胜+2",
  },
  炸弹人: {
    play: "独立第三方阵营，不属于好人、不属于狼人。被投票放逐时引爆炸弹，炸死所有投票给他的玩家（被炸者不能开枪）；爆炸后场上无人生还（全票是其子集），或最后只剩自己存活，则直接独赢（第三方胜）。炸死其他第三方阵营玩家不计分",
    score: "炸死狼+1｜炸死好人-1｜炸死其他第三方 0｜爆炸后无人生还/存活到最后独赢+4",
  },
  丘比特: {
    play: "首夜必连两人成情侣（可连自己），随后情侣认亲互相认识。人狼恋（WG）：丘比特+情侣组成第三方，不要求三人全活，有成员且场上无外人即胜；自连自己+狼为 2 人第三方，不连自己（好人+狼）为 3 人第三方。狼恋人仍与狼同睁眼、参与狼刀，但狼队少 1 个队友，好人阵营相应少人（2 人局少丘比特；3 人局少丘比特+好人恋人）。人人恋/狼狼恋：丘比特是神，无第三方，按普通胜负。野孩子作为情侣黑化时链型动态重算：GG→WG 第三方成立；WG→WW 第三方解散、丘比特变回神。殉情：情侣一方出局另一方立刻同死，殉情出局的猎人/狼王不能开枪",
    score: "人狼恋·第三方胜：丘比特/情侣各+3（死亡成员也算）；狼恋人被女巫毒/猎人带按狼+1，炸弹炸 0，狼王枪带狼恋人 0；好人恋人/丘比特被女巫毒/猎人带按好人-1，炸弹炸 0，狼王枪 0｜人人恋/狼狼恋·好人胜：丘比特+3",
  },
}
const ROLE_ORDER = ["狼人", "白狼王", "狼王", "隐狼", "噩梦之影", "血月使徒", "狼美人", "恶灵骑士", "石像鬼", "预言家", "猎魔人", "摄梦人", "女巫", "猎人", "守卫", "骑士", "白痴", "守墓人", "平民", "野孩子", "炸弹人", "丘比特"]

/** 通用计分规则 */
const GENERAL_NOTE =
  "胜利分：狼胜·狼+3（狼群全员存活：3狼各+0.5、4+狼各+1；石像鬼/隐狼/黑化野孩子不计）；好人胜·神职+3、平民+2、人人/狼狼恋丘比特+3；第三方胜·人狼恋丘比特/情侣各+3（死亡成员也算）、炸弹人独赢+4。通用：MVP+1、SVP+0.5、背锅-0.5；法官主持+0.5/局"

/** 全局规则（唯一权威） */
const GAME_RULES: { title: string; items: string[] }[] = [
  {
    title: "夜间流程",
    items: [
      "首夜：野孩子选榜样→丘比特睁眼→情侣互认→守卫→石像鬼分配→噩梦之影恐惧→狼人→隐狼睁眼（获知狼人号码）→狼美人→预言家→猎魔人→摄梦人→女巫→守墓人→白痴/骑士睁眼→猎人状态→炸弹人睁眼→石像鬼查验→竞选警长→天亮（首夜石像鬼查验挪到所有夜间步骤末尾）",
      "后续每夜：守卫→石像鬼→噩梦之影→狼人→狼美人→预言家→猎魔人→摄梦人→女巫→守墓人→猎人→天亮",
      "守卫：每晚守一人免刀，不能连续两晚守同一人；同守同救则该玩家死亡（奶穿）",
      "狼人：共同选一人刀杀，仅狼狼恋（WW）双狼情侣不可互刀，人狼恋（WG）的狼恋人可被狼队刀；石像鬼/隐狼不参与狼人刀人，其余狼全灭后接管刀人；黑化野孩子下一晚起加入狼群、同睁眼、共享一刀，其他狼全灭后仍保留刀",
      "噩梦之影：恐惧狼→狼队当晚空刀；恐惧神职→其技能当晚失效；恐惧自己/平民无效果",
      "女巫：解药仅首夜中刀时可自救，之后不能自救只能救他人；毒药首夜即可使用；同夜最多用一瓶；被首杀时跳过女巫环节（奶穿）",
      "预言家：每晚验一人，知晓其为狼人或好人阵营（隐狼验为金水）",
      "猎魔人：每晚狩猎，天亮结算——是狼则狼死，是好人则猎魔人反噬；免疫女巫毒",
      "摄梦人：每晚入梦使一人成为梦游者（不能梦自己，免疫夜间伤害）；连续两晚同一人则其被梦杀出局；摄梦人夜间死亡则梦游者殉情",
      "守墓人：第二夜起每晚得知上一白天被公投放逐者属于好人还是狼人阵营",
      "睁眼环节照常念台词：某角色已出局或无人可动时也保留环节（避免语音暗示）",
    ],
  },
  {
    title: "白天流程",
    items: [
      "法官宣布死者→遗言（死者/猎人/狼王开枪/殉情）→自由发言→放逐投票→法官宣布结果",
      "投票规则：每人投一人，票数最高者出局；票数相同则均不出局；警长票算1.5票",
      "自爆规则：只能在【警上发言 / 放逐发言（投票前）】自爆；自爆后当天结束、直接入夜；自爆者为警长时警徽流失；投票/遗言阶段不能自爆",
    ],
  },
  {
    title: "警长规则",
    items: [
      "首夜竞选：所有角色睁眼后，有竞选意向的玩家举手，法官公布竞选名单，依次发言，玩家投票选出警长",
      "警长权利：放逐投票时票算1.5票；决定发言顺序（左/右）；归票权",
      "警徽流失：警长自爆/被白狼王带走/被决斗出局时直接流失；被投票/刀杀/毒杀/枪杀/殉情出局时进入移交/流失决策",
    ],
  },
  {
    title: "胜负判定",
    items: [
      "屠边规则：好人阵营需放逐全部狼人获胜；狼人阵营需屠尽所有神职或所有平民获胜；只统计板子里实际存在的阵营（无平民板子不会因平民=0直接狼胜）。白痴始终属于神职，翻牌只失去投票权",
      "屠城规则：狼人需杀光神职、平民与第三方；诸神之战仅模拟、固定屠城不可切换",
      "胜负时序：先达成胜利条件的一方锁定胜局；之后猎人/狼王开枪等技能照常结算，但不改判",
      "好人胜：狼全灭；若存在第三方（人狼恋第三方/炸弹人）也需全部出局；人狼恋第三方存活时好/狼都不判胜",
      "人狼恋第三方：丘比特+情侣；不要求三人全活，有成员且场上无外人即胜；死亡成员也算+3；自连自己+狼为 2 人，不连自己为 3 人",
      "人狼恋狼恋人：仍参与狼人会议/刀人，但不算狼队队友（狼队少 1 人）；女巫毒/猎人带按狼+1，炸弹炸 0，狼王枪带 0",
      "炸弹人：爆炸后场上无人生还（全票是其子集）或只剩自己 → 第三方胜，最终胜利分+4；炸死其他第三方不计分",
      "丘比特归属：人人恋/狼狼恋无第三方，丘比特是神；人狼恋丘比特属第三方",
      "野孩子作为情侣黑化：链型动态重算；GG→WG 第三方成立（丘比特+两情侣，场上无外人即胜）；WG→WW 第三方解散，丘比特变回神，按普通好/狼胜负",
      "殉情：情侣一方出局另一方立刻同死；殉情出局的猎人/狼王不能开枪",
    ],
  },
]

/** 丘比特/情侣 完整规则（按链型） */
const CUPID_RULES: { title: string; items: string[] } = {
  title: "💘 丘比特 · 情侣规则",
  items: [
    "首夜必连两人成情侣（可连自己），随后情侣互认（只知编号不知身份）",
    "人人恋：情侣都是好人，丘比特是神，无第三方，按普通胜负",
    "狼狼恋：两狼+丘比特（神），无第三方，按普通胜负",
    "人狼恋：丘比特+情侣=第三方；不要求三人全活，有成员且场上无外人即胜；死掉的成员也算+3",
    "人狼恋人数：丘比特连自己+狼 → 2 人第三方；丘比特不连自己（好人+狼）→ 3 人第三方",
    "狼恋人仍参与狼人会议/刀人，但不算狼队队友（狼队少 1 人）；女巫毒/猎人带按狼+1，炸弹炸 0，狼王枪带 0",
    "野孩子作为情侣黑化：GG→WG 第三方成立（丘比特+两情侣）；WG→WW 第三方解散，丘比特变回神",
    "殉情：情侣一方出局另一方立刻同死；殉情出局的猎人/狼王不能开枪",
  ],
}

/** 只列本板子存在的角色，按固定顺序展示 */
const shownRoles = computed(() => {
  const set = new Set(props.roles)
  const list = ROLE_ORDER.filter((r) => set.has(r))
  return list.length ? list : ROLE_ORDER
})
</script>

<template>
  <div class="role-help" :class="{ open }">
    <div v-if="open" class="rh-panel">
      <div class="rh-title">
        角色玩法 · 计分
        <a-button size="small" type="text" style="color: #888" @click="open = false">✕</a-button>
      </div>
      <div class="rh-general">{{ GENERAL_NOTE }}</div>
      <div class="rh-rules">
        <div v-for="g in GAME_RULES" :key="g.title" class="rh-rules-group">
          <div class="rh-rules-title">{{ g.title }}</div>
          <div v-for="(item, i) in g.items" :key="i" class="rh-rules-item">{{ item }}</div>
        </div>
        <div class="rh-rules-group">
          <div class="rh-rules-title">{{ CUPID_RULES.title }}</div>
          <div v-for="(item, i) in CUPID_RULES.items" :key="i" class="rh-rules-item">{{ item }}</div>
        </div>
      </div>
      <div class="rh-list">
        <div v-for="r in shownRoles" :key="r" class="rh-item">
          <span class="rh-emoji">
            <img v-if="roleAvatar(r)" :src="roleAvatar(r)" class="rh-role-img" :alt="r" />
            <span v-else>{{ ROLE_EMOJI[r] || "🎭" }}</span>
          </span>
          <div class="rh-body">
            <div class="rh-name">{{ r }}</div>
            <div class="rh-play">{{ ROLE_INFO[r]?.play || "" }}</div>
            <div class="rh-score">💯 {{ ROLE_INFO[r]?.score || "" }}</div>
          </div>
        </div>
      </div>
    </div>
    <a-tooltip :title="open ? '收起' : '角色玩法速查'" placement="right">
      <a-button class="rh-fab" type="primary" shape="circle" size="large" @click="open = !open">📖</a-button>
    </a-tooltip>
  </div>
</template>

<style scoped>
.role-help {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.rh-fab {
  width: 48px;
  height: 48px;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.rh-panel {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  z-index: 700;
  width: min(320px, calc(100vw - 32px));
  max-height: 62vh;
  overflow-y: auto;
  background: rgba(23, 27, 40, 0.96);
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
}
.rh-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  font-size: 14px;
  color: #eee;
  margin-bottom: 6px;
}
.rh-general {
  font-size: 11px;
  line-height: 1.5;
  color: #c9a86a;
  background: #2b2330;
  border-radius: 8px;
  padding: 6px 8px;
  margin-bottom: 8px;
}
.rh-rules {
  margin-bottom: 8px;
}
.rh-rules-group {
  margin-bottom: 6px;
}
.rh-rules-title {
  font-size: 11px;
  font-weight: 700;
  color: #e8d5a3;
  margin-bottom: 2px;
}
.rh-rules-item {
  font-size: 10px;
  line-height: 1.5;
  color: #bbb;
  padding-left: 6px;
  position: relative;
}
.rh-rules-item::before {
  content: "·";
  position: absolute;
  left: 0;
  color: #666;
}
.rh-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rh-item {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 8px;
  align-items: start;
  padding-bottom: 8px;
  border-bottom: 1px dashed #242b40;
}
.rh-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.rh-emoji {
  font-size: clamp(18px, 2.5vw, 22px);
  line-height: 1;
}
.rh-role-img {
  height: clamp(40px, 4vw, 48px);
  width: auto;
  object-fit: contain;
  vertical-align: middle;
}
.rh-body {
  min-width: 0;
}
.rh-name {
  font-weight: 700;
  font-size: 13px;
  color: #fff;
}
.rh-play {
  font-size: 12px;
  line-height: 1.5;
  color: #ccc;
}
.rh-score {
  font-size: 11px;
  line-height: 1.5;
  color: #7ad6a0;
}
</style>