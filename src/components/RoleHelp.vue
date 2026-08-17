<script setup lang="ts">
import { computed, ref } from "vue"
import { ROLE_EMOJI } from "@/game/logic"

const props = defineProps<{ roles: string[] }>()

const open = ref(false)

/** 每个角色：玩法 + 计分（与 recalcScore 最新逻辑一致） */
const ROLE_INFO: Record<string, { play: string; score: string }> = {
  狼人: {
    play: "每晚刀一人；狼情侣不可互刀；自爆跳过当天投票",
    score: "胜利+3｜3狼存活+0.5、4狼存活+1｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  白狼王: {
    play: "同狼人，白天可自爆带走一人，跳过投票",
    score: "同狼人",
  },
  狼王: {
    play: "同狼人，被刀/放逐（非毒）出局可开枪带走一人",
    score: "胜利+3｜枪带好人+1、枪带狼-1｜悍跳拿警徽+0.5｜自刀骗解药+0.5",
  },
  预言家: {
    play: "每晚验一人，知晓狼/好人",
    score: "拿警徽+0.5｜首夜验狼+0.5｜每晚未验人-0.5",
  },
  女巫: {
    play: "解药救当夜被刀者、毒药毒一人，各一次；同夜只能用一瓶",
    score: "毒狼+1、毒好人-1｜救对好人+0.5",
  },
  猎人: {
    play: "被刀/放逐（非毒、非殉情）出局可开枪带走一人",
    score: "带狼+1、带好人-1",
  },
  守卫: {
    play: "每晚守一人免刀；不能连续两晚守同一人",
    score: "守中+0.5｜同守同救-0.5",
  },
  骑士: {
    play: "每局一次决斗，戳中狼狼死、戳错骑士出局",
    score: "决斗戳狼+1、戳错-1",
  },
  白痴: {
    play: "被放逐翻牌免死，失去投票权",
    score: "神职胜利+3",
  },
  平民: {
    play: "无技能，靠发言投票",
    score: "胜利+2",
  },
  丘比特: {
    play: "首夜必连两人成情侣（可连自己），随后情侣认亲；人狼恋入第三方，情侣同死殉情",
    score: "人人恋好人胜+3｜狼狼恋随狼·狼胜+3｜人狼恋第三方胜+3",
  },
}
const ROLE_ORDER = ["狼人", "白狼王", "狼王", "预言家", "女巫", "猎人", "守卫", "骑士", "白痴", "平民", "丘比特"]

/** 通用计分规则 */
const GENERAL_NOTE =
  "胜利分：狼胜·狼+3（3狼存活+0.5、4狼存活+1）；好人胜·神职+3、平民+2；第三方胜·丘比特+情侣+3；狼狼恋·丘比特随狼+3。通用：MVP+1、SVP+0.5、背锅-0.5；法官主持+0.5/局"

/** 丘比特/情侣 完整规则（按链型） */
const CUPID_RULES = [
  { key: "人人恋", desc: "情侣都是好人：丘比特属好人，狼全灭好人胜" },
  { key: "人狼恋", desc: "一好一狼：丘比特+两情侣=第三方，屠城胜；丘比特活着第三方就在，好/狼都要先清掉丘比特才能赢" },
  { key: "狼狼恋", desc: "情侣都是狼：丘比特随狼阵营，狼屠边胜（不产生第三方）" },
]
const CUPID_NOTE = "丘比特首夜必须连两人（可连自己），随后情侣认亲互相认识（只知编号不知身份）。殉情：情侣一方出局另一方立刻同死；殉情出局的猎人/狼王不能开枪。"

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
      <div class="rh-cupid">
        <div class="rh-cupid-title">💘 丘比特 · 情侣规则（按链型）</div>
        <div v-for="c in CUPID_RULES" :key="c.key" class="rh-cupid-item">
          <span class="rh-cupid-key">{{ c.key }}</span>
          <span class="rh-cupid-desc">{{ c.desc }}</span>
        </div>
        <div class="rh-cupid-note">{{ CUPID_NOTE }}</div>
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
