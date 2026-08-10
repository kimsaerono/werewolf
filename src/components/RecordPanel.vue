<script setup lang="ts">
import { App as AntApp } from "ant-design-vue"
import { buildCSV } from "@/game/logic"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, actions, history, sessionNo } = props.game

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function gen() {
  actions.buildRecord()
  message.success("已生成本局复盘文本")
}
function exportCSV() {
  download(`狼人杀对局_${state.board}.csv`, buildCSV(state), "text/csv;charset=utf-8")
  message.success("已导出CSV")
}
function exportTxt() {
  download("狼人杀复盘.txt", state.recordText, "text/plain")
  message.success("已导出本局复盘TXT")
}
function clearRec() {
  actions.clearRecord()
}
function exportAll() {
  const all = history.value
    .map(
      (h) =>
        `====${h.title}====\n时间：${h.time}\n板子：${h.board}\n胜负：${h.winner}（${h.reason}）\n法官：${h.judge || "-"}（累计 ${h.judgeScore}）\n` +
        h.players
          .map((p) => `玩家 ${p.no}.${p.name} 身份：${p.role}，${p.alive ? "存活" : "出局"}，本轮分：${p.scoreRound.toFixed(1)}，总分：${p.scoreTotal.toFixed(1)}`)
          .join("\n") +
        `\n\n----对局日志----\n${h.log.join("\n")}\n\n`,
    )
    .join("")
  download("狼人杀历史复盘.txt", all, "text/plain")
  message.success(`已导出全部 ${history.value.length} 局复盘`)
}
</script>

<template>
  <div class="panel">
    <a-card title="📋 本局复盘" :bordered="false">
      <a-textarea
        style="margin-bottom: 10px"
        :value="state.recordText"
        :rows="8"
        readonly
        placeholder="点击下方「生成本局复盘」生成包含全部角色、加减分明细、对局日志的文本..."
      />
      <a-space :wrap="true">
        <a-tag color="gold">{{ history.length ? `下一局：第 ${sessionNo} 局` : "当前第 1 局" }}</a-tag>
        <a-button type="primary" size="small" @click="gen">生成本局复盘</a-button>
        <a-button @click="exportTxt">导出本局TXT</a-button>
        <a-button @click="exportCSV">导出本局CSV</a-button>
        <a-button danger size="small" @click="clearRec">清空本局文本</a-button>
      </a-space>
    </a-card>

    <a-card title="🗂️ 历史对局记录（自动保存）" :bordered="false">
      <a-empty v-if="!history.length" description="暂无已结束的对局" :image-simple="true" />
      <a-collapse v-else accordion>
        <a-collapse-panel
          v-for="(h, i) in history"
          :key="i"
          :header="`${h.title} ｜ ${h.winner}`"
        >
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
            <div v-for="(l, j) in h.log" :key="j">{{ l }}</div>
          </div>
        </a-collapse-panel>
      </a-collapse>
      <a-button v-if="history.length" style="margin-top: 12px" @click="exportAll">
        导出全部历史复盘TXT
      </a-button>
    </a-card>
  </div>
</template>

<style scoped>
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
