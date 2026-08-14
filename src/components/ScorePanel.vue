<script setup lang="ts">
import type { Game } from "@/types"

const props = defineProps<{ game: Game }>()
const { state, actions } = props.game

const columns = [
  { title: "玩家", dataIndex: "name", key: "name" },
  { title: "身份", dataIndex: "role", key: "role" },
  {
    title: "存活",
    dataIndex: "alive",
    key: "alive",
    customRender: ({ record }: { record: { alive: boolean } }) => (record.alive ? "✅" : "❌"),
  },
  {
    title: "技能分明细",
    dataIndex: "scoreDetail",
    key: "scoreDetail",
    customRender: ({ record }: { record: { scoreDetail: string[] } }) =>
      record.scoreDetail.join("；") || "-",
  },
  {
    title: "本轮分",
    dataIndex: "scoreRound",
    key: "scoreRound",
    customRender: ({ record }: { record: { scoreRound: number } }) => record.scoreRound.toFixed(1),
  },
  {
    title: "总分数",
    dataIndex: "scoreTotal",
    key: "scoreTotal",
    customRender: ({ record }: { record: { scoreTotal: number } }) => record.scoreTotal.toFixed(1),
  },
]
function rowKey(r: { name: string }) {
  return r.name
}
</script>

<template>
  <div class="panel">
    <a-card title="📊 本局玩家个人分数明细（自动计算）" :bordered="false">
      <a-table
        :data-source="state.players"
        :columns="columns"
        :pagination="false"
        size="small"
        :scroll="{ x: 'max-content' }"
        :row-key="rowKey"
      />
    </a-card>

    <a-card title="计分规则摘要" :bordered="false">
      <div class="small" style="line-height: 2">
        <div>胜利：狼人胜·狼人+3（存活3狼+0.5、4狼+1）；好人胜·神职+3、平民+2；第三方胜·丘比特/情侣+3；丘比特属好人时好人胜+3</div>
        <div>预言家：拿警徽+0.5｜首夜验狼+0.5｜每晚未验人-0.5</div>
        <div>女巫：毒狼+1、毒好人-1｜救对好人+0.5</div>
        <div>猎人：带狼+1、带好人-1</div>
        <div>骑士：决斗戳狼+1、戳错-1</div>
        <div>狼王：枪带好人+1、枪带狼-1</div>
        <div>守卫：守中+0.5｜同守同救-0.5</div>
        <div>狼系：悍跳拿警徽+0.5｜自刀骗解药+0.5</div>
        <div>MVP+1，SVP+0.5，背锅侠-0.5（手动选择）；法官主持+0.5/局</div>
      </div>
    </a-card>
  </div>
</template>
