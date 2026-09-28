<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { theme, Modal, message } from "ant-design-vue"
import { useGame } from "@/composables/useGame"
import BoardSignupPanel from "@/components/BoardSignupPanel.vue"
import GamePanel from "@/components/GamePanel.vue"
import ScorePanel from "@/components/ScorePanel.vue"
import RecordPanel from "@/components/RecordPanel.vue"
import RoleHelp from "@/components/RoleHelp.vue"
import ModeSelectPage from "@/components/ModeSelectPage.vue"
import SyncSettings from "@/components/SyncSettings.vue"
import MusicPlayerDrawer from "@/components/MusicPlayerDrawer.vue"
import { useMusicPlayer } from "@/composables/useMusicPlayer"
import loadingPng from "@/assets/roles/loading.png"

const game = useGame()
const { state, activeTab, winNotice, winNoticeOpen, refs, actions, syncStatus } = game

/** 全局忙碌中：同步飞书/测试连接等耗时操作时显示 loading 遮罩 */
const busy = computed(() => syncStatus.value === "syncing" || syncStatus.value === "testing")

// 同步完成/失败提示：监听 syncStatus，成功弹 ✅，失败弹 ⚠️（同步中不提示，由遮罩展示）
watch(syncStatus, (s) => {
  if (!s || s === "syncing" || s === "testing") return
  if (s.startsWith("✅")) message.success(s, 5)
  else if (s.startsWith("⚠️")) message.error(s, 6)
})

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
/** 整局重置：保留参与玩家名单，清空角色/积分/日志/复盘（保留板子/法官/胜负模式/对局模式） */
function onResetGame() {
  Modal.confirm({
    title: "🗑️ 整局重置？",
    content: "保留参与玩家名单，清空：本局角色、积分、日志、复盘记录（保留板子/法官/胜负模式）。此操作不可撤销！",
    okText: "确认重置",
    okButtonProps: { danger: true },
    cancelText: "取消",
    onOk() {
      actions.startNextGame()
      activeTab.value = "board"
      message.success("已整局重置，玩家名单保留，请重新发牌")
    },
  })
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
const gamePanelRef = ref<InstanceType<typeof GamePanel> | null>(null)
const leftActionsOpen = ref(false)
const musicPlayer = useMusicPlayer()
const musicDrawerOpen = ref(false)

function openMusicPlayer() {
  leftActionsOpen.value = false
  musicDrawerOpen.value = true
}

watch(
  () => [state.phase, state.finished] as const,
  ([phase, finished]) => {
    // 音乐只读对局状态；万一音频层异常，绝不能把异常抛回对局流程
    try {
      musicPlayer.syncPhase(phase, finished)
    } catch (e) {
      console.warn("背景音乐切换失败（已忽略）", e)
    }
  },
  { immediate: true, flush: "sync" },
)

onBeforeUnmount(() => musicPlayer.dispose())

function onTabChange(key: string) {
  if (key === "game" && !gameReady.value) {
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
      <ModeSelectPage v-if="!state.modeChosen" :game="game" />
      <template v-else>
      <div
        class="app-shell"
        :class="[`phase-${state.phase}`, state.simMode ? 'wm-sim' : 'wm-real']"
      >
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
            :disabled="t.id === 'game' && !gameReady"
          />
        </a-tabs>
      </div>

      <div class="page" :class="{ 'page-full': activeTab === 'score' || activeTab === 'record' }">
        <BoardSignupPanel v-show="activeTab === 'board'" :game="game" />
        <GamePanel v-show="activeTab === 'game'" ref="gamePanelRef" :game="game" />
        <ScorePanel v-show="activeTab === 'score'" :game="game" />
        <RecordPanel v-show="activeTab === 'record'" :game="game" />
      </div>
      </div>

      <!-- 左下悬浮：展开的功能项 -->
      <TransitionGroup name="fab-pop-left" tag="div" class="left-actions-items">
        <RoleHelp v-if="leftActionsOpen" :roles="refs.getBoardRoles(state)" key="rolehelp" />
        <a-tooltip v-if="leftActionsOpen" title="语音播报配置" key="voice">
          <a-button class="fab" type="default" shape="circle" size="large" @click="gamePanelRef?.openVoiceDrawer()">🎙️</a-button>
        </a-tooltip>
        <a-tooltip v-if="leftActionsOpen" title="切换对局模式" placement="right" key="mode">
          <a-button class="fab fab-mode" type="default" shape="circle" size="large" aria-label="切换对局模式" @click="actions.setModeChosen(false)">🎲</a-button>
        </a-tooltip>
        <a-tooltip v-if="leftActionsOpen" title="夜晚背景音乐" placement="right" key="music">
          <a-button class="fab fab-music" type="default" shape="circle" size="large" aria-label="打开夜晚背景音乐" @click="openMusicPlayer">♫</a-button>
        </a-tooltip>
        <a-tooltip v-if="leftActionsOpen" title="整局重置" placement="right" key="reset">
          <a-button class="fab fab-reset" danger shape="circle" size="large" @click="onResetGame">🗑️</a-button>
        </a-tooltip>
        <SyncSettings v-if="leftActionsOpen && !state.simMode" key="sync" />
      </TransitionGroup>
      <!-- 左下悬浮：固定在底部的 toggle -->
      <a-button class="fab fab-toggle left-toggle" shape="circle" size="large" @click="leftActionsOpen = !leftActionsOpen">⚙️</a-button>

      <!-- 胜负弹窗 -->
      <a-modal v-model:open="winNoticeOpen" :footer="null" width="460px" :closable="false" centered>
        <div v-if="winNotice" class="win-notice">
          <div class="win-emoji">🏆</div>
          <h2 class="win-title">{{ winNotice.text }}</h2>
          <p class="win-reason">原因：{{ winNotice.reason }}</p>
          <pre class="win-camps">{{ winNotice.camps }}</pre>
          <p v-if="state.simMode" class="small" style="color:#66bb6a;margin-top:6px">🧪 模拟模式</p>
          <p class="small">已自动结算并保存本局积分与日志{{ state.simMode ? '' : '。等今天 2-3 局打完，到「📊 分数明细 → 累积玩家个人分数明细」点「同步今日到飞书」统一写入' }}</p>
          <p v-if="state.winCamp" class="small" style="color:#ffd666;margin-top:6px">🏆 MVP/SVP 自动建议：{{ honorSuggestion }}</p>
          <a-button type="primary" size="large" block style="margin-top: 10px" @click="onWinConfirm">
            知道了
          </a-button>
        </div>
      </a-modal>
      <MusicPlayerDrawer :open="musicDrawerOpen" :player="musicPlayer" @close="musicDrawerOpen = false" />
      </template>

      <!-- 全局忙碌遮罩：同步飞书等耗时操作时显示 loading.png 动画 -->
      <div v-if="busy" class="global-loading">
        <img class="global-loading-img" :src="loadingPng" alt="加载中" />
        <div class="global-loading-text">处理中…</div>
      </div>
    </a-app>
  </a-config-provider>
</template>

<style>
* {
  box-sizing: border-box;
}
html,
body {
  /* 关掉整页下拉回弹 / 下拉刷新，否则到顶继续下拉时 sticky 顶栏会跟着一起位移
     （sticky 本身没问题，是浏览器 overscroll 行为；viewport meta 管不了这个） */
  overscroll-behavior-y: none;
}
body {
  margin: 0;
  background: #0f1115;
}
/* 全局忙碌遮罩：半透明深色背景 + 居中 loading 图旋转动画 */
.global-loading {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(8, 11, 20, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.global-loading-img {
  width: 72px;
  height: 72px;
  animation: global-loading-spin 1.1s linear infinite;
}
.global-loading-text {
  color: #ddd;
  font-size: 14px;
  letter-spacing: 2px;
}
@keyframes global-loading-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
/* 卡片半透明（不带 backdrop-filter，避免成为 fixed 定位的包含块，破坏悬浮座位牌左右固定布局） */
.ant-card {
  background: rgba(23, 27, 40, 0.55);
}
.ant-card-bordered {
  border-color: #2b3145aa;
}
/* 只收紧「有标题」卡片的内边距；无头卡片（如对局步骤卡）保持默认 24px。
   :has() 提高特异性，压过 Ant 的 :where(.css-hash).ant-card .ant-card-body（0,2,0）。 */
body .ant-card:has(.ant-card-head) > .ant-card-body {
  padding: 0;
}
.ant-modal .ant-card,
.ant-drawer .ant-card {
  background: #171b28;
}
/* 弹层 / 抽屉内部滚动到边界时不把 overscroll 传给页面，避免带动整页回弹 */
.ant-modal-body,
.ant-drawer-body {
  overscroll-behavior: contain;
}
/* ===== 夜晚 / 白天背景切换 ===== */
.app-shell {
  min-height: 100vh;
  transition: background 0.5s ease;
  position: relative;
}
/* 背景水印：跟随模式变色，固定铺满不滚动，不遮挡交互 */
.app-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-repeat: repeat;
}
.app-shell.wm-sim::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='440'%3E%3Ctext x='80' y='90' text-anchor='middle' transform='rotate(-28 80 90)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='80' y='220' text-anchor='middle' transform='rotate(-28 80 220)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='80' y='350' text-anchor='middle' transform='rotate(-28 80 350)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='240' y='90' text-anchor='middle' transform='rotate(-28 240 90)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='240' y='220' text-anchor='middle' transform='rotate(-28 240 220)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='240' y='350' text-anchor='middle' transform='rotate(-28 240 350)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='400' y='90' text-anchor='middle' transform='rotate(-28 400 90)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='400' y='220' text-anchor='middle' transform='rotate(-28 400 220)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3Ctext x='400' y='350' text-anchor='middle' transform='rotate(-28 400 350)' font-size='30' font-weight='800' fill='%23d4fde0' fill-opacity='0.3'%3E模拟模式%3C/text%3E%3C/svg%3E");
}
.app-shell.wm-real::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='440'%3E%3Ctext x='80' y='90' text-anchor='middle' transform='rotate(-28 80 90)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='80' y='220' text-anchor='middle' transform='rotate(-28 80 220)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='80' y='350' text-anchor='middle' transform='rotate(-28 80 350)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='240' y='90' text-anchor='middle' transform='rotate(-28 240 90)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='240' y='220' text-anchor='middle' transform='rotate(-28 240 220)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='240' y='350' text-anchor='middle' transform='rotate(-28 240 350)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='400' y='90' text-anchor='middle' transform='rotate(-28 400 90)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='400' y='220' text-anchor='middle' transform='rotate(-28 400 220)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3Ctext x='400' y='350' text-anchor='middle' transform='rotate(-28 400 350)' font-size='30' font-weight='800' fill='%23e8dcc0' fill-opacity='0.28'%3E真实模式%3C/text%3E%3C/svg%3E");
}
.app-shell > * {
  position: relative;
  z-index: 1;
}
.app-shell.phase-night {
  background: linear-gradient(180deg, #0a0d16 0%, #101a2e 100%);
}
.app-shell.wm-sim.phase-night {
  background: linear-gradient(180deg, #b26326 0%,#e18238 70%, #0c1f12 100%);
}
.app-shell.phase-day {
  background: linear-gradient(180deg, #12151d 0%, #1c2436 100%);
}
.app-shell.wm-sim.phase-day {
  background: linear-gradient(180deg, #b26326 0%,#e18238 70%, #163020 100%);
}
.app-shell.phase-idle {
  background: #0f1115;
}
.app-shell.wm-sim.phase-idle {
  background: #0c1710;
}
/* 真实模式整屏底色：暖卡其调，和模拟模式的绿调区分 */
.app-shell.wm-real.phase-night {
  background: linear-gradient(180deg, #4b266f 0%,#a56edd 70%, #241d12 100%);
}
.app-shell.wm-real.phase-day {
  background: linear-gradient(180deg, #4b266f 0%,#a56edd 70%, #28211a 100%);
}
.app-shell.wm-real.phase-idle {
  background: #15120d;
}
/* 模式标签：模拟=深绿实底浅字，真实=浅卡其底深棕字（深色界面上更醒目） */
.mode-tag {
  border-radius: 999px;
  font-weight: 600;
}
.mode-tag.sim {
  color: #eafbe9;
  background: #2e7d32;
  border-color: #2e7d32;
}
.mode-tag.real {
  color: #5c4a2e;
  background: #efe3c8;
  border-color: #d9c49a;
}

/* 悬浮座位牌列宽（桌面 76px / 移动端 62px），内容区让位；
   --seat-ext 是玻璃面板比卡片多出的细边宽度；
   --seat-retract 是整列默认收起的比例（50% = 半遮面，点一下完整滑出） */
:root {
  --seat-col-w: 76px;
  --seat-ext: 8px;
  --seat-retract: 50%;
}
@media (max-width: 720px) {
  :root {
    --seat-col-w: 62px;
    --seat-ext: 7px;
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
  padding:10px
}
/* 左侧：toggle 固定底部 */
.left-toggle {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 601;
}
/* 左侧：功能项在 toggle 上方 */
.left-actions-items {
  position: fixed;
  left: 16px;
  bottom: 72px;
  z-index: 600;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  align-items: center;
}
.fab-reset {
  border: 1px solid rgba(255, 77, 79, 0.6) !important;
}
.fab-mode {
  /* 醒目：用琥珀色实心描边 + 深底，和旁边中性的 🎙️ / ♫ 区分开 */
  background: linear-gradient(135deg, #3a2c08 0%, #241c05 100%) !important;
  border: 2px solid #d4a017 !important;
  color: #ffd666 !important;
  font-size: 20px;
  box-shadow: 0 0 0 3px rgba(212, 160, 23, 0.18);
}
.fab-mode:hover {
  background: linear-gradient(135deg, #4d3a0b 0%, #33280a 100%) !important;
  border-color: #ffd666 !important;
}
.fab-toggle {
  background: rgba(30, 35, 50, 0.92) !important;
  color: #eee !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5) !important;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.fab-toggle:active {
  transform: scale(0.92);
}

/* 左侧展开/收起动画 */
.fab-pop-left-enter-active {
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fab-pop-left-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  position: absolute;
}
.fab-pop-left-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.5);
}
.fab-pop-left-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.5);
}
.fab-pop-left-move {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  overscroll-behavior: contain;
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
/* 法官卡片：现在法官留在成员池里（双击可换/取消），必须保持可点击。
   旧设计把法官过滤出池子，这里曾用 pointer-events: none 禁用，会让「再次双击取消法官」失效。 */
.member-item.judge {
  cursor: pointer;
  border-color: #ffa50255;
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
/* 抽屉响应式：小屏占满宽度 */
@media (max-width: 520px) {
  .ant-drawer-content-wrapper {
    width: 100vw !important;
  }
}
</style>
