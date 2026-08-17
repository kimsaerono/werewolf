<script setup lang="ts">
import { computed, ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, actions, todayGames, syncStatus } = props.game

// ===== 本局明细 =====
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
]

// ===== 累积（当天对局聚合） =====
interface AggRow {
  name: string
  games: number
  total: number
  per: (number | null)[]
}
const todayAgg = computed<AggRow[]>(() => {
  const games = todayGames.value
  const map = new Map<string, AggRow>()
  games.forEach((h, gi) => {
    h.players.forEach((p) => {
      const row = map.get(p.name) || { name: p.name, games: 0, total: 0, per: games.map(() => null) }
      row.games++
      row.total = Math.round((row.total + p.scoreRound) * 10) / 10
      row.per[gi] = p.scoreRound
      map.set(p.name, row)
    })
  })
  return [...map.values()].sort((a, b) => b.total - a.total)
})

const aggColumns = computed(() => {
  const base: Record<string, unknown>[] = [
    { title: "玩家", dataIndex: "name", key: "name" },
    { title: "今日场次", dataIndex: "games", key: "games" },
    {
      title: "累计分",
      dataIndex: "total",
      key: "total",
      customRender: ({ record }: { record: AggRow }) => record.total.toFixed(1),
    },
  ]
  todayGames.value.forEach((_, i) => {
    base.push({
      title: `第${i + 1}局`,
      dataIndex: "per",
      key: `g${i}`,
      customRender: ({ record }: { record: AggRow }) => (record.per[i] != null ? record.per[i]!.toFixed(1) : "-"),
    })
  })
  return base
})

function timeHM(t: string): string {
  const s = String(t || "").split(" ")[1] || ""
  return s.slice(0, 5)
}

const syncing = ref(false)
async function doSyncDay() {
  syncing.value = true
  try {
    const r = await actions.syncDayGames()
    if (r.err) message.error(r.err)
    else message.success(`已同步今日 ${r.ok} 局到飞书`)
  } finally {
    syncing.value = false
  }
}

function rowKey(r: { name: string }) {
  return r.name
}
</script>

<template>
  <div class="panel">
    <a-card :bordered="false">
      <a-tabs>
        <template #tabBarExtraContent>
          <a-tag :color="state.simMode ? '#2e7d32' : '#1668dc'" style="margin-right: 8px">{{ state.simMode ? "🧪 模拟对局" : "🎯 真实对局" }}</a-tag>
        </template>
        <a-tab-pane key="cur" tab="本局玩家个人分数明细">
          <a-table
            :data-source="state.players"
            :columns="columns"
            :pagination="false"
            size="small"
            :scroll="{ x: 'max-content' }"
            :row-key="rowKey"
          />
        </a-tab-pane>

        <a-tab-pane key="today" tab="累积玩家个人分数明细（当天）">
          <div v-if="!todayGames.length" class="small" style="padding: 16px 0; text-align: center; color: #888">
            今天还没有已结束的对局
          </div>
          <template v-else>
            <div class="today-tags">
              <a-tag v-for="(h, i) in todayGames" :key="i" :color="state.simMode ? '#2e7d32' : (h.synced ? 'green' : 'orange')">
                {{ `第${i + 1}局` }} · {{ timeHM(h.time) }}<template v-if="!state.simMode"> {{ h.synced ? "✅已同步" : "未同步" }}</template>
              </a-tag>
              <span v-if="syncStatus" class="small" style="color: #ffd666">{{ syncStatus }}</span>
            </div>
            <a-table
              :data-source="todayAgg"
              :columns="aggColumns"
              :pagination="false"
              size="small"
              :scroll="{ x: 'max-content' }"
              :row-key="rowKey"
            />
            <div v-if="!state.simMode" class="sync-row">
              <a-button type="primary" :loading="syncing" @click="doSyncDay">☁️ 同步今日到飞书</a-button>
              <span class="small" style="color: #888">手动触发：逐局写入复盘表 + 按姓名累加排名；已同步的局不会重复累加</span>
            </div>
            <div v-else class="sync-row">
              <a-tag color="#2e7d32">🧪 模拟模式</a-tag>
            </div>
          </template>
        </a-tab-pane>
      </a-tabs>
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

<style scoped>
.today-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.sync-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}
</style>
