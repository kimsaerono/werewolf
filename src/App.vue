<script setup lang="ts">
import { computed, ref } from "vue"
import { theme, message } from "ant-design-vue"
import { useGame } from "@/composables/useGame"
import BoardSignupPanel from "@/components/BoardSignupPanel.vue"
import GamePanel from "@/components/GamePanel.vue"
import ScorePanel from "@/components/ScorePanel.vue"
import RecordPanel from "@/components/RecordPanel.vue"

const game = useGame()
const { state, activeTab, winNotice, winNoticeOpen, refs } = game

/** 本局 MVP/SVP 自动建议（非必需，仅供参考） */
const honorSuggestion = computed(() => {
  if (!state.winCamp) return ""
  const r = refs.suggestHonor(state)
  const parts = []
  if (r.mvp) parts.push(`MVP：${r.mvp}`)
  if (r.svp) parts.push(`SVP：${r.svp}`)
  return parts.length ? parts.join("，") : "本局无突出者"
})

/** 结算弹窗：确认关闭（飞书同步改在「分数明细 → 累积」页手动触发） */
function onWinConfirm() {
  winNoticeOpen.value = false
}
const tabs = [
  { id: "board", label: "🎲 板子与选人" },
  { id: "game", label: "🎮 对局操作" },
  { id: "score", label: "📊 分数明细" },
  { id: "record", label: "🗂️ 历史对局" },
]

const boardNeed = computed(() => refs.getBoardRoles(state).length)
const countMatch = computed(() => state.players.length === boardNeed.value && state.players.length > 0)
const gameReady = computed(() => countMatch.value && state.playersConfirmed)
const prevTab = ref("board")

function onTabChange(key: string) {
  const locked = ["game", "score", "record"]
  if (locked.includes(key) && !gameReady.value) {
    message.warning("请先在「板子与选人」确认参与玩家")
    activeTab.value = prevTab.value
    return
  }
  prevTab.value = key
}
</script>

<template>
  <a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
    <a-app>
      <div class="app-shell" :class="`phase-${state.phase}`">
      <div class="sticky-tabs">
        <a-tabs
          v-model:activeKey="activeTab"
          :tab-bar-style="{ marginBottom: 12 }"
          @change="onTabChange"
        >
          <a-tab-pane
            v-for="t in tabs"
            :key="t.id"
            :tab="t.label"
            :disabled="['game', 'score', 'record'].includes(t.id) && !gameReady"
          />
        </a-tabs>
      </div>

      <div class="page" :class="{ 'page-full': activeTab === 'score' || activeTab === 'record' }">
        <BoardSignupPanel v-show="activeTab === 'board'" :game="game" />
        <GamePanel v-show="activeTab === 'game'" :game="game" />
        <ScorePanel v-show="activeTab === 'score'" :game="game" />
        <RecordPanel v-show="activeTab === 'record'" :game="game" />
      </div>
      </div>

      <!-- 胜负弹窗 -->
      <a-modal v-model:open="winNoticeOpen" :footer="null" width="460px" :closable="false" centered>
        <div v-if="winNotice" class="win-notice">
          <div class="win-emoji">🏆</div>
          <h2 class="win-title">{{ winNotice.text }}</h2>
          <p class="win-reason">原因：{{ winNotice.reason }}</p>
          <pre class="win-camps">{{ winNotice.camps }}</pre>
          <p class="small">已自动结算并保存本局积分与日志。等今天 2-3 局打完，到「📊 分数明细 → 累积玩家个人分数明细」点「同步今日到飞书」统一写入</p>
          <p v-if="state.winCamp" class="small" style="color:#ffd666;margin-top:6px">🏆 MVP/SVP 自动建议：{{ honorSuggestion }}</p>
          <a-button type="primary" size="large" block style="margin-top: 10px" @click="onWinConfirm">
            知道了
          </a-button>
        </div>
      </a-modal>
    </a-app>
  </a-config-provider>
</template>

<style>
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #0f1115;
}
/* ===== 夜晚 / 白天背景切换 ===== */
.app-shell {
  min-height: 100vh;
  transition: background 0.5s ease;
}
.app-shell.phase-night {
  background: linear-gradient(180deg, #0a0d16 0%, #101a2e 100%);
}
.app-shell.phase-day {
  background: linear-gradient(180deg, #12151d 0%, #1c2436 100%);
}
.app-shell.phase-idle {
  background: #0f1115;
}
/* 悬浮座位牌列宽（桌面 76px / 移动端 62px），内容区让位 */
:root {
  --seat-col-w: 76px;
}
@media (max-width: 720px) {
  :root {
    --seat-col-w: 62px;
  }
}
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 16px 40px;
  overflow-x: hidden;
  box-sizing: border-box;
}
/* 分数明细 / 复盘导出：无左右留白，内容全宽 */
.page.page-full {
  padding: 16px;
}
.win-notice {
  text-align: center;
  padding: 8px 0;
}
.win-emoji {
  font-size: 52px;
}
.win-title {
  margin: 8px 0 6px;
  color: #ff6464;
}
.win-reason {
  color: #ddd;
  margin: 0 0 6px;
}
.win-camps {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  line-height: 1.8;
  color: #eee;
  white-space: pre-wrap;
  margin: 0 0 6px;
}
.sticky-tabs {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15, 17, 21, 0.85);
  backdrop-filter: blur(8px);
  padding: 6px 0 0;
  width: 100%;
}
.sticky-tabs :deep(.ant-tabs) {
  width: 100%;
}
.sticky-tabs :deep(.ant-tabs-nav) {
  width: 100%;
}
.sticky-tabs :deep(.ant-tabs-tab) {
  flex: 1;
  justify-content: center;
  text-align: center;
}
.sticky-tabs :deep(.ant-tabs-nav-wrap) {
  display: flex;
}
.sticky-tabs :deep(.ant-tabs-nav-list) {
  display: flex;
  width: 100%;
}
.panel {
  margin-bottom: 14px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0;
  align-items: center;
}
.ant-card + .ant-card {
  margin-top: 12px;
}
/* 文案尽量不换行、不省略：缩小字号适配 */
.ant-card-head-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  min-width: 0;
  font-size: 13px;
}
.ant-card-head {
  flex-wrap: wrap;
}
.ant-card-head-title .ant-tag,
.ant-card-head-title .small,
.ant-card-head-title span {
  font-size: 12px;
}
.ant-divider-inner-text {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  max-width: 100%;
  font-size: 12px;
}
/* 按钮组可收缩换行，避免横向溢出 */
.ant-btn {
  max-width: 100%;
}
.start-game-bar {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: #0f1115ee;
  padding: 12px 0;
  backdrop-filter: blur(6px);
}
.setup-panel {
  padding-bottom: 90px;
}
.role-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 12px;
}
.role-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1d2233;
  border: 1px solid #333c55;
  border-radius: 10px;
  padding: 4px 8px;
}
.role-chip-name {
  font-weight: 600;
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}
.role-chip-count {
  color: #ffa502;
  font-weight: 700;
  font-size: 14px;
  min-width: 22px;
  text-align: center;
}
.role-btn {
  margin: 0;
}
.role-btn.ant-btn-circle.ant-btn-sm {
  width: 24px;
  height: 24px;
  line-height: 22px;
}
.member-pool {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 10px;
  background: #171b28;
  touch-action: pan-y;
}
.member-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.15s, border-color 0.15s;
}
.member-item:hover {
  background: #232a3d;
}
.member-item.added {
  color: #2ed573;
  font-weight: 600;
  border-color: #2ed57355;
  background: #2ed57314;
}
.member-check {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  background: #2a2e40;
  color: #0f1115;
}
.member-item.added .member-check {
  background: #2ed573;
  color: #0f1115;
}
.member-item.judge {
  cursor: not-allowed;
  border-color: #ffa50255;
  pointer-events: none;
  opacity: 1;
}
.member-item.judge .member-name {
  color: #ffd666;
  font-weight: 700;
}
.role-assign-card {
  background: #1d2233;
  border: 1px solid #333c55;
  border-radius: 10px;
  padding: 12px;
}
.role-assign-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.role-avatar {
  font-size: 18px;
}
.role-avatar-img {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.slot-no {
  width: 22px;
  height: 22px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2a2e40;
  color: #999;
  font-size: 12px;
}
.flex-spacer {
  flex: 1;
}
.role-remaining {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.role-remaining-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  background: #1d2233;
  border: 1px solid #333c55;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.role-remaining-item:hover {
  border-color: #2ed573;
  background: #2ed57314;
}
@media (max-width: 720px) {
  .page {
    padding: 10px 40px;
    overflow-x: hidden;
  }
  .page.page-full {
    padding: 10px;
  }
  .row {
    gap: 8px;
  }
}
</style>
