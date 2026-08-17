<script setup lang="ts">
import { computed, ref } from "vue"
import { ROLE_EMOJI } from "@/game/logic"

const props = defineProps<{ roles: string[] }>()

const open = ref(false)

/** 每个角色：玩法 + 计分（与 recalcScore 最新逻辑一致） */
const ROLE_INFO: Record<string, { play: string; score: string }> = {
  狼人: {
    play: "每晚共同选一人刀杀；狼情侣不可互刀；白天可自爆跳过投票，自爆时若为警长则警徽流失",
    score: "胜利+3｜3狼存活+0.5、4狼存活+1｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  白狼王: {
    play: "同狼人，白天可自爆带走一人（被带走者不能开枪），跳过投票；被投票/毒死/殉情时不能带走人",
    score: "同狼人",
  },
  狼王: {
    play: "同狼人，被刀死或被放逐投票出局可开枪带走一人；被毒死、殉情、白狼王带走时不能开枪",
    score: "胜利+3｜枪带好人+1、枪带狼-1｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  预言家: {
    play: "每晚验一人，知晓其为狼人或好人阵营",
    score: "拿警徽+0.5｜首夜验狼+0.5｜每晚未验人-0.5",
  },
  女巫: {
    play: "解药仅首夜可自救，之后只能救人；毒药第二夜起可毒一人；同夜只能用一瓶；被首杀时跳过女巫环节（奶穿）",
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
    play: "被放逐时翻牌免死，之后失去投票权",
    score: "神职胜利+3",
  },
  平民: {
    play: "无特殊技能，靠发言和投票",
    score: "胜利+2",
  },
  丘比特: {
    play: "首夜必连两人成情侣（可连自己），随后情侣认亲互相认识；殉情：情侣一方出局另一方立刻同死，殉情出局的猎人/狼王不能开枪",
    score: "人人/狼狼恋好人胜+3｜人狼恋第三方胜+3",
  },
}
const ROLE_ORDER = ["狼人", "白狼王", "狼王", "预言家", "女巫", "猎人", "守卫", "骑士", "白痴", "平民", "丘比特"]

/** 通用计分规则 */
const GENERAL_NOTE =
  "胜利分：狼胜·狼+3（3狼存活+0.5、4狼存活+1）；好人胜·神职+3、平民+2、丘比特+3；第三方胜·丘比特+情侣+3。通用：MVP+1、SVP+0.5、背锅-0.5；法官主持+0.5/局"

/** 全局规则（唯一权威） */
const GAME_RULES: { title: string; items: string[] }[] = [
  {
    title: "夜间流程",
    items: [
      "首夜：丘比特睁眼→情侣互认→守卫→狼人→女巫→预言家→猎人状态→白痴/骑士睁眼→竞选警长→天亮",
      "后续每夜：守卫→狼人→女巫→预言家→天亮",
      "守卫：每晚守一人，不能连续两晚守同一人；同守同救则该玩家死亡（奶穿）",
      "狼人：共同选一人刀杀，狼情侣不可互刀",
      "女巫：解药仅首夜可自救，之后只能救人；毒药第二夜起可毒一人；同夜只能用一瓶；被首杀时跳过女巫环节（奶穿）",
      "预言家：每晚验一人，知晓其为狼人或好人阵营",
    ],
  },
  {
    title: "白天流程",
    items: [
      "法官宣布死者→遗言（死者/猎人/狼王开枪/殉情）→自由发言→放逐投票→法官宣布结果",
      "投票规则：每人投一人，票数最高者出局；票数相同则均不出局；警长票算1.5票",
      "自爆规则：狼人/白狼王白天可自爆跳过投票；自爆者为警长时警徽流失；投票/遗言阶段不能自爆",
      "白狼王自爆：可带走一人，被带走者不能开枪，跳过投票",
    ],
  },
  {
    title: "警长规则",
    items: [
      "首夜竞选：所有角色睁眼后，有竞选意向的玩家举手，法官公布竞选名单，依次发言，玩家投票选出警长",
      "警长权利：放逐投票时票算1.5票；决定发言顺序（左/右）；归票权",
      "警徽流失：警长出局（无论何种原因）时，警徽直接流失",
    ],
  },
  {
    title: "胜负判定",
    items: [
      "屠边规则：好人阵营需放逐全部狼人获胜；狼人阵营需屠尽所有神职或所有平民获胜",
      "第三方：人狼恋产生第三方（丘比特+两情侣），第三方需存活且场上仅剩第三方阵营才能获胜",
      "丘比特归属：人人恋/狼狼恋无第三方，丘比特属好人阵营；人狼恋丘比特属第三方",
      "殉情：情侣一方出局另一方立刻同死；殉情出局的猎人/狼王不能开枪",
    ],
  },
]

/** 丘比特/情侣 完整规则（按链型） */
const CUPID_RULES: { title: string; items: string[] } = {
  title: "💘 丘比特 · 情侣规则",
  items: [
    "首夜必连两人成情侣（可连自己），随后情侣互认（只知编号不知身份）",
    "人人恋：情侣都是好人，丘比特属好人，狼全灭好人胜",
    "狼狼恋：无第三方，丘比特属好人；好人胜=狼全灭，狼胜=屠边",
    "人狼恋：丘比特+两情侣=第三方，屠城胜；丘比特活着第三方就在",
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
          <span class="rh-emoji">{{ ROLE_EMOJI[r] || "🎭" }}</span>
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
  position: fixed;
  left: 16px;
  bottom: 20px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.rh-fab {
  width: 48px;
  height: 48px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.rh-panel {
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
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
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
@media (max-width: 720px) {
  .role-help {
    left: 10px;
    bottom: 14px;
  }
}
</style>
