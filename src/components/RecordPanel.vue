<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import { decorateLog, cleanLogLine, isWolfRole, GOD_LIST } from "@/game/logic"
import { themeRoleShort, themeText } from "@/composables/useTheme"
import type { Game } from "@/types"
import type { GameRecord, RecordPatch } from "@/composables/useGame"
import { getRoleInstance } from "@/game/roles/builtin"

const { message, modal } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { historyByDay, actions, refs, recordTxtOf, syncStatus, isSyncing, state } = props.game

/** 历史记录日志展示：去时间 + 玩家名转 号码(身份) */
function fmtLog(h: GameRecord, l: string, i: number): string {
  return `${i + 1}. ${themeText(decorateLog({ players: h.players } as never, cleanLogLine(l)))}`
}
function timeHM(t: string): string {
  const s = String(t || "").split(" ")[1] || ""
  return s.slice(0, 5)
}

/** 历史对局玩家是否属于第三方，返回标注（第三阵营·原角色 / 第三方·炸弹人） */
function thirdLabel(h: GameRecord, p: { name: string; role: string }): string {
  const role = getRoleInstance(p.role)
  // 炸弹人是独立第三方，与链型无关
  if (role && role.def.id === "炸弹人") return `第三方·${p.role}`
  // 优先用结算时固化的链型：野孩子作为情侣黑化后链型会变（GG→WG / WG→WW），
  // 旧记录没有 chain 时才回退到按历史玩家重算（effectiveCampOf 已兼容缺失 mark）。
  const chain = h.chain ?? refs.getChainType({ lovers: h.lovers, players: h.players } as never)
  if (chain !== "WG") return ""
  if (h.lovers.includes(p.name) || (role && role.def.id === "丘比特")) return `第三阵营·${p.role}`
  return ""
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

/** ===== 修改本局（保存并同步飞书）===== */
const editOpen = ref(false)
const editing = ref<GameRecord | null>(null)
const saving = ref(false)
const form = reactive({
  winner: "",
  reason: "",
  mvp: "",
  svp: "",
  beiguo: "",
  scores: {} as Record<string, number | null>,
})
const winnerOptions = ["狼人胜利", "好人胜利", "第三方胜利", "平局"].map((v) => ({ value: v }))
const reasonOptions = [
  "屠边：神职全灭",
  "屠边：平民全灭",
  "屠城：所有好人出局",
  "所有狼人已出局，好人胜利",
  "第三方胜利",
  "平局",
].map((v) => ({ value: v }))
const playerOptions = computed(() =>
  (editing.value?.players || []).map((p) => ({ value: p.name, label: `${p.no}.${p.name}（${p.role}）` })),
)

function openEdit(h: GameRecord) {
  editing.value = h
  form.winner = h.winner
  form.reason = h.reason
  form.mvp = h.mvp || ""
  form.svp = h.svp || ""
  form.beiguo = h.beiguo || ""
  const m: Record<string, number | null> = {}
  for (const p of h.players) m[p.name] = p.scoreRound
  form.scores = m
  editOpen.value = true
}

/** 按当前选择的胜负，给每人填基础分（狼胜狼+3、其余0；好人胜神/民按 3/2、狼0），技能分可再手调 */
function autoFillByResult() {
  const h = editing.value
  if (!h) return
  const winWolf = form.winner.includes("狼人")
  const winThird = form.winner.includes("第三方")
  for (const p of h.players) {
    const role = getRoleInstance(p.role)
    const wolf = isWolfRole(p.role)
    const god = GOD_LIST.includes(p.role)
    const isCivil = role && role.def.camp === "villager"
    const isCupid = role && role.def.id === "丘比特"
    const thirdWin = winThird && (isCupid || (h.lovers || []).includes(p.name))
    const win = thirdWin ? true : winThird ? false : wolf ? winWolf : !winWolf
    form.scores[p.name] = win ? (wolf ? 3 : god ? 3 : isCivil ? 2 : 3) : 0
  }
}

async function submitEdit() {
  const h = editing.value
  if (!h) return
  const picks = [form.mvp, form.svp, form.beiguo].filter(Boolean)
  if (new Set(picks).size !== picks.length) {
    message.error("MVP / SVP / 背锅侠不能选同一名玩家")
    return
  }
  const patch: RecordPatch = {
    winner: form.winner,
    reason: form.reason,
    mvp: form.mvp,
    svp: form.svp,
    beiguo: form.beiguo,
    scores: h.players.map((p) => ({ name: p.name, scoreRound: Number(form.scores[p.name] || 0) })),
  }
  saving.value = true
  try {
    const err = await actions.editAndResync(h, patch)
    if (err) message.error(err)
    else {
      message.success("已保存并同步到飞书")
      editOpen.value = false
    }
  } finally {
    saving.value = false
  }
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
        <a-space :wrap="true">
          <a-button v-if="historyByDay.length" danger size="small" @click="onClearAll">🗑️ 清空所有历史数据</a-button>
        </a-space>
      </template>

      <a-empty v-if="!historyByDay.length" description="暂无已结束的对局" :image-simple="true" />
      <div v-else v-for="(day, di) in historyByDay" :key="day.key" class="day-group">
        <div class="day-header">
          <span class="day-title">📅 {{ day.label }}（{{ day.games.length }}局）</span>
          <a-button size="small" @click="exportDayTxt(day)">📄 导出当天TXT</a-button>
        </div>
        <a-collapse accordion>
          <a-collapse-panel v-for="(h, i) in day.games" :key="`${di}-${i}`">
            <template #header>
              <span class="game-line">
                <span class="game-title">{{ `第${i + 1}局 · ${h.boardFinal || refs.boardShortName(h.board)} ｜ ${h.winner}` }}</span>
                <template v-if="!state.simMode">
                  <span v-if="h.synced" class="game-sync synced">✅已同步</span>
                  <a-button v-else size="small" type="primary" :loading="isSyncing(h)" @click.stop="syncOne(h)">☁️ 同步</a-button>
                  <a-button size="small" @click.stop="openEdit(h)">✏️ 修改</a-button>
                </template>
              </span>
            </template>
            <p class="small" style="margin-top: 0">时间：{{ h.time }} ｜ 板子：{{ h.boardFinal || h.board }}</p>
            <p class="small">原因：{{ h.reason }} ｜ 法官：{{ h.judge || "-" }}</p>
            <div v-if="h.mvp || h.svp || h.beiguo" class="small" style="color: #ffd666">
              🏆 {{ [h.mvp ? `MVP：${h.mvp}` : "", h.svp ? `SVP：${h.svp}` : "", h.beiguo ? `背锅侠：${h.beiguo}` : ""].filter(Boolean).join(" ｜ ") }}
            </div>
            <a-divider style="margin: 8px 0">积分</a-divider>
            <a-space :wrap="true">
              <a-tag v-for="p in h.players" :key="p.name" :color="p.scoreRound >= 0 ? 'green' : 'red'" :title="thirdLabel(h, p) ? themeText(thirdLabel(h, p)) : themeRoleShort(p.role)">
                {{ p.no }}.{{ p.name }}({{ thirdLabel(h, p) ? themeText(thirdLabel(h, p)) : themeRoleShort(p.role) }}) {{ p.scoreRound >= 0 ? "+" : "" }}{{ p.scoreRound.toFixed(1) }}
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

    <a-modal
      v-model:open="editOpen"
      title="✏️ 修改本局（保存并同步飞书）"
      :confirm-loading="saving"
      ok-text="确定（保存并同步飞书）"
      cancel-text="取消"
      :width="680"
      @ok="submitEdit"
    >
      <div v-if="editing" class="edit-form">
        <a-form layout="vertical">
          <a-form-item label="胜负">
            <a-select v-model:value="form.winner" :options="winnerOptions" />
          </a-form-item>
          <a-form-item label="原因">
            <a-auto-complete v-model:value="form.reason" :options="reasonOptions" placeholder="可下拉选择或直接输入" />
          </a-form-item>
          <a-form-item label="荣誉">
            <a-space :wrap="true">
              <a-select v-model:value="form.mvp" :options="playerOptions" placeholder="MVP" allow-clear style="width: 170px" />
              <a-select v-model:value="form.svp" :options="playerOptions" placeholder="SVP" allow-clear style="width: 170px" />
              <a-select v-model:value="form.beiguo" :options="playerOptions" placeholder="背锅侠" allow-clear style="width: 170px" />
            </a-space>
          </a-form-item>
          <a-form-item>
            <template #label>
              <span>逐人本轮分</span>
              <a-button size="small" type="link" @click="autoFillByResult">按当前胜负自动填基础分</a-button>
            </template>
            <div class="score-grid">
              <div v-for="p in editing.players" :key="p.name" class="score-row">
                <span class="score-label">{{ p.no }}.{{ p.name }}（{{ p.role }}）</span>
                <a-input-number v-model:value="form.scores[p.name]" :step="0.5" style="width: 120px" />
              </div>
            </div>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.day-group {
  padding:5px;
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
.score-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}
.score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.score-label {
  font-size: 13px;
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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