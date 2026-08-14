<script setup lang="ts">
import { App as AntApp } from "ant-design-vue"
import { decorateLog, cleanLogLine } from "@/game/logic"
import type { Game } from "@/types"
import type { GameRecord } from "@/composables/useGame"

const { message, modal } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { historyByDay, actions, refs, recordTxtOf, syncStatus, isSyncing } = props.game

/** 历史记录日志展示：去时间 + 玩家名转 号码(身份) */
function fmtLog(h: GameRecord, l: string, i: number): string {
  return `${i + 1}. ${decorateLog({ players: h.players } as never, cleanLogLine(l))}`
}
function timeHM(t: string): string {
  const s = String(t || "").split(" ")[1] || ""
  return s.slice(0, 5)
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** 复制本局详情（含日志） */
async function copyGame(h: GameRecord) {
  try {
    await navigator.clipboard.writeText(recordTxtOf(h))
    message.success("已复制本局详情到剪贴板")
  } catch {
    message.error("复制失败，请手动复制")
  }
}

/** 导出当天 TXT */
function exportDayTxt(day: { label: string; games: GameRecord[] }) {
  const all = day.games.map((h) => recordTxtOf(h)).join("")
  download(`狼人杀_${day.label}.txt`, "\uFEFF" + all, "text/plain;charset=utf-8")
  message.success(`已导出 ${day.label} 共 ${day.games.length} 局TXT`)
}

/** 单场同步 */
async function syncOne(h: GameRecord) {
  const err = await actions.syncRecord(h)
  if (err) message.error(err)
}

/** 清空所有历史数据（二次确认） */
function onClearAll() {
  modal.confirm({
    title: "🗑️ 清空所有历史数据？",
    content: "将清空：历史对局记录、本局玩家/角色/积分/日志、法官累计分（保留板子/法官/胜负模式）。此操作不可撤销！",
    okText: "确认清空",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      actions.clearAllData()
      message.success("已清空所有历史数据")
    },
  })
}
</script>

<template>
  <div class="panel">
    <a-card title="🗂️ 历史对局记录（自动保存）" :bordered="false">
      <template #extra>
        <a-button v-if="historyByDay.length" danger size="small" @click="onClearAll">🗑️ 清空所有历史数据</a-button>
      </template>

      <a-empty v-if="!historyByDay.length" description="暂无已结束的对局" :image-simple="true" />
      <div v-else v-for="(day, di) in historyByDay" :key="day.key" class="day-group">
        <div class="day-header">
          <span class="day-title">📅 {{ day.label }}（{{ day.games.length }}局）</span>
          <a-button size="small" @click="exportDayTxt(day)">📄 导出当天TXT</a-button>
          <span v-if="syncStatus" class="small sync-status">{{ syncStatus }}</span>
        </div>
        <a-collapse accordion>
          <a-collapse-panel v-for="(h, i) in day.games" :key="`${di}-${i}`">
            <template #header>
              <span class="game-line">
                <span class="game-title">{{ `第${i + 1}局 · ${refs.boardShortName(h.board)} ｜ ${h.winner}` }}</span>
                <span v-if="h.synced" class="game-sync synced">✅已同步</span>
                <a-button v-else size="small" type="primary" :loading="isSyncing(h)" @click.stop="syncOne(h)">☁️ 同步</a-button>
              </span>
            </template>
            <p class="small" style="margin-top: 0">时间：{{ h.time }} ｜ 板子：{{ h.board }}（{{ refs.boardShortName(h.board) }}）</p>
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
            <a-button size="small" style="margin-top: 12px" @click="copyGame(h)">📋 复制本局详情</a-button>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.day-group {
  margin-bottom: 14px;
}
.day-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.day-title {
  font-weight: 700;
  font-size: 14px;
  color: #eee;
}
.sync-status {
  color: #ffd666;
  margin-left: 6px;
}
.game-line {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.game-title {
  font-weight: 600;
}
.game-sync {
  font-size: 12px;
}
.game-sync.synced {
  color: #2ed573;
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
