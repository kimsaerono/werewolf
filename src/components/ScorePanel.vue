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
      <div class="row" style="margin-top: 12px">
        <a-button danger @click="actions.resetRoundScore()">重置本局所有玩家临时分</a-button>
      </div>
    </a-card>

    <a-card title="计分规则摘要" :bordered="false">
      <div class="small" style="line-height: 2">
        <div>狼人胜利每人+3；神职胜利每人+3；平民胜利每人+2</div>
        <div>预言家拿警徽+0.5；首夜验狼+0.5；每晚不验人-0.5</div>
        <div>女巫毒狼+1(上限1)，毒好人-1；解药救对好人+0.5</div>
        <div>猎人带狼+1，带好人-1；守卫守中+0.5(上限1)；同守同救-0.5</div>
        <div>狼人悍跳拿警徽+0.5；自刀骗解药+0.5；胜利3狼存活+0.5；4狼存活+1</div>
        <div>投票投出狼人+0.5(上限1)；投出好人-0.5；预言家/狼人不计投票分</div>
        <div>MVP+1，SVP+0.5，背锅侠-0.5（手动选择）</div>
      </div>
    </a-card>
  </div>
</template>
