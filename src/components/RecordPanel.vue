<script setup lang="ts">
import { computed, ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import { decorateLog, cleanLogLine } from "@/game/logic"
import type { Game } from "@/types"
import type { GameRecord } from "@/composables/useGame"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { history } = props.game

/** 勾选导出的历史局索引 */
const selected = ref<number[]>([])
const selectedCount = computed(() => selected.value.length)

function toggleSelect(i: number) {
  selected.value = selected.value.includes(i)
    ? selected.value.filter((x) => x !== i)
    : [...selected.value, i]
}
function selectAll() {
  selected.value = history.value.map((_, i) => i)
}
function clearSelect() {
  selected.value = []
}
/** 按对局先后顺序取选中的记录 */
function selectedRecords(): GameRecord[] {
  return [...selected.value].sort((a, b) => a - b).map((i) => history.value[i])
}

/** 历史记录日志展示：去时间 + 玩家名转 号码(身份) */
function fmtLog(h: GameRecord, l: string, i: number): string {
  return `${i + 1}. ${decorateLog({ players: h.players } as never, cleanLogLine(l))}`
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function recordTxt(h: GameRecord): string {
  return (
    `====${h.title}====\n时间：${h.time}\n板子：${h.board}\n胜负：${h.winner}（${h.reason}）\n法官：${h.judge || "-"}（累计 ${h.judgeScore}）\n` +
    h.players
      .map((p) => `玩家 ${p.no}.${p.name} 身份：${p.role}，${p.alive ? "存活" : "出局"}，本轮分：${p.scoreRound.toFixed(1)}，总分：${p.scoreTotal.toFixed(1)}`)
      .join("\n") +
    `\n\n----对局日志----\n${h.log.map((l, i) => fmtLog(h, l, i)).join("\n")}\n\n`
  )
}

function exportSelectedTxt() {
  const recs = selectedRecords()
  if (!recs.length) return message.warning("请先勾选要导出的对局")
  download("狼人杀选中复盘.txt", "\uFEFF" + recs.map(recordTxt).join(""), "text/plain;charset=utf-8")
  message.success(`已导出选中 ${recs.length} 局复盘TXT`)
}

function escCsv(v: string): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

/** 多局 CSV：每局每个玩家一行，前置对局上下文列 */
function buildHistoryCSV(recs: GameRecord[]): string {
  const header = ["局号", "时间", "板子", "胜负", "原因", "法官", "号码", "玩家", "身份", "存活", "技能分明细", "本轮分", "总分"]
  const rows: string[] = [header.map(escCsv).join(",")]
  for (const h of recs) {
    for (const p of h.players) {
      rows.push(
        [
          h.title,
          h.time,
          h.board,
          h.winner,
          h.reason,
          h.judge ? `${h.judge}（${h.judgeScore}分）` : "-",
          String(p.no),
          p.name,
          p.role,
          p.alive ? "存活" : "出局",
          p.scoreDetail.join("；") || "-",
          p.scoreRound.toFixed(1),
          p.scoreTotal.toFixed(1),
        ]
          .map(escCsv)
          .join(","),
      )
    }
  }
  return "\uFEFF" + rows.join("\r\n")
}

function exportSelectedCsv() {
  const recs = selectedRecords()
  if (!recs.length) return message.warning("请先勾选要导出的对局")
  download("狼人杀历史.csv", buildHistoryCSV(recs), "text/csv;charset=utf-8")
  message.success(`已导出选中 ${recs.length} 局CSV`)
}
</script>

<template>
  <div class="panel">
    <a-card title="🗂️ 历史对局记录（自动保存）" :bordered="false">
      <a-empty v-if="!history.length" description="暂无已结束的对局" :image-simple="true" />
      <template v-else>
        <a-collapse accordion>
          <a-collapse-panel v-for="(h, i) in history" :key="i">
            <template #header>
              <span class="record-header">
                <span class="record-check" @click.stop>
                  <a-checkbox :checked="selected.includes(i)" @change="() => toggleSelect(i)" />
                </span>
                <span>{{ h.title }} ｜ {{ h.winner }}</span>
              </span>
            </template>
            <p class="small" style="margin-top: 0">时间：{{ h.time }} ｜ 板子：{{ h.board }}</p>
            <p class="small">原因：{{ h.reason }} ｜ 法官：{{ h.judge || "-" }}（累计 {{ h.judgeScore }} 分）</p>
            <a-divider style="margin: 8px 0">积分</a-divider>
            <a-space :wrap="true">
              <a-tag v-for="p in h.players" :key="p.name" :color="p.scoreRound >= 0 ? 'green' : 'red'">
                {{ p.no }}.{{ p.name }}({{ p.role }}) {{ p.scoreRound >= 0 ? "+" : "" }}{{ p.scoreRound.toFixed(1) }}
              </a-tag>
            </a-space>
            <a-divider style="margin: 8px 0">对局日志</a-divider>
            <div class="logbox">
              <div v-for="(l, j) in h.log" :key="j">{{ fmtLog(h, l, j) }}</div>
            </div>
          </a-collapse-panel>
        </a-collapse>
        <div class="row" style="margin-top: 12px">
          <a-space :wrap="true">
            <a-button size="small" @click="selectAll">全选</a-button>
            <a-button size="small" @click="clearSelect">清空</a-button>
            <a-tag v-if="selectedCount" color="gold">已选 {{ selectedCount }} 局</a-tag>
            <a-button type="primary" :disabled="!selectedCount" @click="exportSelectedTxt">导出选中TXT</a-button>
            <a-button :disabled="!selectedCount" @click="exportSelectedCsv">导出选中CSV</a-button>
          </a-space>
        </div>
      </template>
    </a-card>
  </div>
</template>

<style scoped>
.record-header {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.record-check {
  display: inline-flex;
  align-items: center;
}
.logbox {
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.7;
  color: #aaa;
  background: #171b28;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
