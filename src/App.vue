<script setup lang="ts">
import { computed, ref } from "vue"
import { theme, message } from "ant-design-vue"
import { useGame } from "@/composables/useGame"
import BoardSignupPanel from "@/components/BoardSignupPanel.vue"
import GamePanel from "@/components/GamePanel.vue"
import ScorePanel from "@/components/ScorePanel.vue"
import EndPanel from "@/components/EndPanel.vue"
import RecordPanel from "@/components/RecordPanel.vue"

const game = useGame()
const { state, activeTab, winNotice, winNoticeOpen, refs } = game
const tabs = [
  { id: "board", label: "🎲 板子与选人" },
  { id: "game", label: "🎮 对局操作" },
  { id: "score", label: "📊 分数明细" },
  { id: "end", label: "🏁 结算(MVP/SVP)" },
  { id: "record", label: "📋 复盘导出" },
]

const boardNeed = computed(() => refs.getBoardRoles(state).length)
const countMatch = computed(() => state.players.length === boardNeed.value && state.players.length > 0)
const gameReady = computed(() => countMatch.value && state.playersConfirmed)
const prevTab = ref("board")

function onTabChange(key: string) {
  const locked = ["game", "score", "end", "record"]
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
      <div class="page">
        <header class="page-header">
          <h1>🔮 狼人杀全自动计分法官</h1>
          <p class="subtitle">法官发牌后夜晚睁眼确认身份 ｜ 自动判胜负 · 自动算技能分</p>
        </header>

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
              :disabled="['game', 'score', 'end', 'record'].includes(t.id) && !gameReady"
            />
          </a-tabs>
        </div>

        <BoardSignupPanel v-show="activeTab === 'board'" :game="game" />
        <GamePanel v-show="activeTab === 'game'" :game="game" />
        <ScorePanel v-show="activeTab === 'score'" :game="game" />
        <EndPanel v-show="activeTab === 'end'" :game="game" />
        <RecordPanel v-show="activeTab === 'record'" :game="game" />
      </div>

      <!-- 胜负弹窗 -->
      <a-modal v-model:open="winNoticeOpen" :footer="null" width="460px" :closable="false" centered>
        <div v-if="winNotice" class="win-notice">
          <div class="win-emoji">🏆</div>
          <h2 class="win-title">{{ winNotice.text }}</h2>
          <p class="win-reason">原因：{{ winNotice.reason }}</p>
          <pre class="win-camps">{{ winNotice.camps }}</pre>
          <p class="small">已自动结算并保存本局积分与日志，可在「📊 分数明细」「📋 复盘导出」查看</p>
          <a-button type="primary" size="large" block style="margin-top: 10px" @click="winNoticeOpen = false">
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
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 16px;
}
.page-header {
  text-align: center;
  margin-bottom: 8px;
}
.page-header h1 {
  font-size: 24px;
  color: #ff6464;
  margin: 8px 0 4px;
}
.subtitle {
  color: #888;
  font-size: 13px;
  margin: 0 0 8px;
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
  background: #0f1115;
  padding: 6px 0 0;
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
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #ffa50255;
  pointer-events: none;
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
.signed-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #2b3145;
  background: #1d2233;
  margin: 6px 0;
  cursor: grab;
}
.signed-row.dragging {
  opacity: 0.5;
  border-style: dashed;
}
.seat-no {
  width: 26px;
  height: 26px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #3742fa;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}
.signed-name {
  font-weight: 600;
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
    padding: 10px;
  }
  .page-header h1 {
    font-size: 18px;
  }
  .ant-tabs .ant-tabs-tab {
    padding: 8px 10px;
  }
  .row {
    gap: 8px;
  }
}
</style>
