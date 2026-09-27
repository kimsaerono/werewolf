<script setup lang="ts">
import { computed, ref, onMounted } from "vue"
import { App as AntApp } from "ant-design-vue"
import type { Game } from "@/types"
import { roleShort } from "@/game/logic"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, actions, refs } = props.game

const winText = computed(() => (state.winCamp ? refs.WIN_TEXT[state.winCamp] : "未判定"))
/** 本局被求解器判过「1% 弱势方」的阵营，复盘时值得点出来 */
const underdogText = computed(() =>
  state.underdogs.map((c) => (c === "wolf" ? "狼人" : "好人")).join("、"),
)
const starOptions = ["-", "⭐入门", "⭐⭐熟练", "⭐⭐⭐精通"]

const showTimeline = ref(false)
const finishing = ref(false)
const finishProgress = ref(0)
const finishStep = ref("")

// 时间线数据
const timelineEvents = computed(() => {
  const events = []
  for (const f of state.flow) {
    const emoji = {
      "守卫守人": "🛡️", "狼人刀人": "🌑", "预言家验人": "🔮",
      "女巫解药": "💚", "女巫毒药": "☠️", "天亮": "🌅",
      "丘比特连人": "💘", "猎人开枪": "🔫", "猎人弃枪": "⏭️",
      "狼王开枪": "🔫", "狼王弃枪": "⏭️", "骑士决斗": "⚔️",
      "警徽": "📢", "放逐": "🗳️", "狼人自爆": "💥",
      "白狼王自爆": "💥", "情侣认亲": "💑", "白痴翻牌": "🙊"
    }[f.label] || "·"

    let target = ""
    if (f.target) {
      const names = f.target.split("、")
      target = names.map(n => {
        const p = state.players.find(p => p.name === n)
        return p ? `${p.no || "?"}号${refs.playerLabel(p)}` : n
      }).join("、")
    }

    events.push({
      night: f.night,
      label: f.label,
      emoji,
      target,
      detail: f.detail
    })
  }
  return events
})

// 统计数据
const stats = computed(() => {
  const alive = state.players.filter(p => p.alive)
  const dead = state.players.filter(p => !p.alive)
  const wolves = state.players.filter(p => p.role && ["狼人", "狼王", "白狼王"].includes(p.role))
  const gods = state.players.filter(p => p.role && ["预言家", "女巫", "猎人", "守卫", "骑士"].includes(p.role))
  const villagers = state.players.filter(p => p.role === "平民")

  return {
    total: state.players.length,
    alive: alive.length,
    dead: dead.length,
    wolves: wolves.length,
    gods: gods.length,
    villagers: villagers.length,
    rounds: state.round,
    winCamp: state.winCamp,
    comeback: state.comeback
  }
})

const winBannerClass = computed(() => {
  if (state.winCamp === "wolf") return "wolf"
  if (state.winCamp === "god") return "good"
  if (state.winCamp === "third") return "third"
  return "draw"
});

const winBannerText = computed(() => {
  if (state.winCamp === "wolf") return "🐺 狼人胜利"
  if (state.winCamp === "god") return "👼 好人胜利"
  if (state.winCamp === "third") return "💘 第三方胜利"
  return "⚖️ 平局"
})

const winSubText = computed(() => {
  if (state.comeback) return "🔥 绝地翻盘！"
  if (state.underdogs.length) return `曾劣势：${underdogText.value}`
  return "";
});

const starRating = (star: string) => {
  const idx = starOptions.indexOf(star)
  return Array.from({ length: 3 }, (_, i) => i < idx ? "⭐" : "☆").join("")
}

function doHonor() {
  actions.applyHonor(state.mvp, state.svp, state.beiguo);
  message.success("荣誉加分已应用");
}

async function doFinish() {
  finishing.value = true;
  finishProgress.value = 0;
  finishStep.value = "计算胜负分...";

  const steps = [
    { step: "计算胜负分...", progress: 20 },
    { step: "计算存活分...", progress: 40 },
    { step: "计算狼人存活分...", progress: 60 },
    { step: "固化总分...", progress: 80 },
    { step: "完成", progress: 100 }
  ];

  for (const s of steps) {
    finishStep.value = s.step;
    finishProgress.value = s.progress;
    await new Promise(r => setTimeout(r, 300));
  }

  const err = actions.finishGameAuto();
  if (err) {
    message.error(err);
    finishing.value = false;
    return;
  }

  finishProgress.value = 100;
  finishStep.value = "完成";
  await new Promise(r => setTimeout(r, 500));
  finishing.value = false;
  message.success("结算完成，总分已固化");
}
</script>

<template>
  <div class="panel">
    <!-- 胜负横幅 -->
    <div v-if="state.finished || state.winCamp" class="win-banner" :class="winBannerClass">
      <div class="win-banner-main">{{ winBannerText }}</div>
      <div class="win-banner-sub" v-if="winSubText">{{ winSubText }}</div>
    </div>

    <div class="panel">
      <!-- 胜负判定卡片 -->
      <a-card :bordered="false" class="result-card">
        <template #title>
          <div class="result-title">
            <span class="result-icon">{{ state.winCamp === 'wolf' ? '🐺' : state.winCamp === 'god' ? '👼' : '💘' }}</span>
            <span>自动判定胜利阵营</span>
          </div>
        </template>
        <a-descriptions :column="2" size="small" :colon="false">
          <a-descriptions-item label="胜利阵营">
            <a-tag :color="state.winCamp === 'wolf' ? 'volcano' : state.winCamp === 'god' ? 'cyan' : state.winCamp === 'third' ? 'purple' : 'gold'" style="font-size: 15px">{{ winBannerText }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item v-if="state.comeback" label="特殊标记">
            <a-tag color="volcano">🔥 绝地翻盘</a-tag>
          </a-descriptions-item>
          <a-descriptions-item v-if="underdogText" label="📉 曾处劣势">
            <span style="color: #999">{{ underdogText }}</span>
          </a-descriptions-item>
          <a-descriptions-item v-if="state.judge" label="⚖️ 法官">
            {{ state.judge }} <span class="small">(+0.5/局)</span>
          </a-descriptions-item>
          <a-descriptions-item label="回合数">
            <b>{{ stats.rounds }} 晚</b>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 数据统计卡片 -->
      <a-card :bordered="false" class="stats-card">
        <template #title>
          <span>📊 本局数据统计</span>
        </template>
        <a-row :gutter="16">
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card">
              <span class="stat-icon">👥</span>
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总人数</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card">
              <span class="stat-icon">💚</span>
              <div class="stat-value">{{ stats.alive }}</div>
              <div class="stat-label">存活</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card">
              <span class="stat-icon">💀</span>
              <div class="stat-value">{{ stats.dead }}</div>
              <div class="stat-label">出局</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card wolf">
              <span class="stat-icon">🐺</span>
              <div class="stat-value">{{ stats.wolves }}</div>
              <div class="stat-label">狼人</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card god">
              <span class="stat-icon">👼</span>
              <div class="stat-value">{{ stats.gods }}</div>
              <div class="stat-label">神职</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card villager">
              <span class="stat-icon">👨‍🌾</span>
              <div class="stat-value">{{ stats.villagers }}</div>
              <div class="stat-label">平民</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card round">
              <span class="stat-icon">🌙</span>
              <div class="stat-value">{{ stats.rounds }}</div>
              <div class="stat-label">回合数</div>
            </div>
          </a-col>
          <a-col :xs="12" :sm="6" :lg="4">
            <div class="stat-card win">
              <span class="stat-icon">{{ stats.winCamp === 'wolf' ? '🐺' : stats.winCamp === 'god' ? '👼' : '💘' }}</span>
              <div class="stat-value">{{ stats.winCamp === 'wolf' ? '狼胜' : stats.winCamp === 'god' ? '好胜' : '第三胜' }}</div>
              <div class="stat-label">胜利方</div>
            </div>
          </a-col>
        </a-row>
      </a-card>

      <!-- 时间线/回放 -->
      <a-card :bordered="false" class="timeline-card">
        <template #title>
          <a-flex :justify="'space-between'" :align="'center'">
            <span>🕐 对局时间线</span>
            <a-button size="small" type="text" @click="showTimeline = !showTimeline">
              {{ showTimeline ? "收起" : "展开" }} 回放
            </a-button>
          </a-flex>
        </template>
        <div v-show="showTimeline" class="timeline-container">
          <div class="timeline" v-if="timelineEvents.length">
            <div class="timeline-item" v-for="(e, i) in timelineEvents" :key="i">
              <div class="timeline-marker">{{ e.emoji }}</div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-night">第 {{ e.night }} 晚</span>
                  <span class="timeline-label">{{ e.label }}</span>
                </div>
                <div class="timeline-detail" v-if="e.target">
                  <span class="detail-target">{{ e.target }}</span>
                  <span v-if="e.detail" class="detail-extra">({{ e.detail }})</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="timeline-empty">暂无流程记录</div>
        </div>
      </a-card>

      <!-- 荣誉选择 -->
      <a-card :bordered="false" class="honor-card">
        <template #title>
          <span>🏆 荣誉选择（主观，手动选）</span>
        </template>
        <a-space :wrap="true" class="honor-select">
          <a-select
            style="min-width: 180px"
            v-model:value="state.mvp"
            placeholder="‑MVP(+1)‑"
            allow-clear
            :options="state.players.map((p) => ({ value: p.name, label: refs.playerLabel(p) }))"
          />
          <a-select
            style="min-width: 180px"
            v-model:value="state.svp"
            placeholder="‑SVP(+0.5)‑"
            allow-clear
            :options="state.players.map((p) => ({ value: p.name, label: refs.playerLabel(p) }))"
          />
          <a-select
            style="min-width: 180px"
            v-model:value="state.beiguo"
            placeholder="‑背锅侠(-0.5)‑"
            allow-clear
            :options="state.players.map((p) => ({ value: p.name, label: refs.playerLabel(p) }))"
          />
        </a-space>
        <div class="row">
          <a-button type="primary" @click="doHonor">应用荣誉加分扣分</a-button>
        </div>
      </a-card>

      <!-- 星级认证 -->
      <a-card :bordered="false" class="star-card">
        <template #title>
          <span>⭐ 角色星级认证</span>
        </template>
        <a-row :gutter="[12, 8]">
          <a-col v-for="p in state.players" :key="p.name" :xs="24" :sm="12" :lg="8">
            <div class="star-player">
              <span class="star-player-info" :title="p.role">{{ p.name }}({{ roleShort(p.role) }})</span>
              <div class="star-rating" v-for="i in 3" :key="i">
                <span
                  class="star"
                  :class="{ filled: starOptions.indexOf(p.star) > i - 1 }"
                  @click="p.star = starOptions[Math.min(i, starOptions.length - 1)]"
                >
                  {{ i <= (starOptions.indexOf(p.star) > 0 ? Math.min(starOptions.indexOf(p.star), 3) : 0) ? '⭐' : '☆' }}
                </span>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-card>

      <!-- 一键结算 -->
      <a-card :bordered="false" class="finish-card">
        <template v-if="!finishing">
          <a-button type="primary" danger size="large" block @click="doFinish">
            ✅ 一键完整结算（自动胜负分+狼人存活分，固化总分）
          </a-button>
        </template>
        <template v-else>
          <div class="finish-progress">
            <div class="finish-step">{{ finishStep }}</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: finishProgress + '%' }"></div>
            </div>
            <div class="finish-hint">正在结算中，请稍候...</div>
          </div>
        </template>
        <a-alert v-if="state.finished && !finishing" type="success" show-icon message="本局已结算，总分已固化" style="margin-top: 12px" />
      </a-card>
    </div>
  </div>
</templat


<style scoped>
/* ===== 胜负横幅 ===== */
.win-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  margin: -16px -16px 16px;
  border-radius: 0 0 16px 16px;
  text-align: center;
  animation: bannerEnter 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
}
@keyframes bannerEnter {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
.win-banner.wolf {
  background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
  color: #fff;
}
.win-banner.good {
  background: linear-gradient(135deg, #1a5f7a 0%, #2980b9 100%);
  color: #fff;
}
.win-banner.third {
  background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
  color: #fff;
}
.win-banner.draw {
  background: linear-gradient(135deg, #7f8c8d 0%, #95a5a6 100%);
  color: #fff;
}
.win-banner-main {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 4px;
  text-shadow: 0 2px 8px rgba(0,0,0,.3);
}
.win-banner-sub {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

/* ===== 结果卡片 ===== */
.result-card {
  margin-bottom: 16px;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.result-icon { font-size: 18px; }

/* ===== 统计卡片 ===== */
.stats-card {
  margin-bottom: 16px;
}
.stats-card .ant-card-head-title {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.stats-card .ant-row > div {
  padding: 0 8px;
}
.stat-card {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  transition: all 0.2s ease;
  height: 100%;
}
.stat-card:hover {
  border-color: #3a4466;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,.2);
}
.stat-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}
.stat-label {
  color: #888;
  font-size: 12px;
}
.stat-card.wolf .stat-value { color: #ff6b6b; }
.stat-card.god .stat-value { color: #4ecdc4; }
.stat-card.villager .stat-value { color: #ffe66d; }
.stat-card.round .stat-value { color: #ffa502; }
.stat-card.win .stat-value { color: #66bb6a; }

/* ===== 时间线 ===== */
.timeline-card {
  margin-bottom: 16px;
}
.timeline-card .ant-card-head-title {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.timeline-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}
.timeline {
  position: relative;
  padding-left: 24px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #1668dc 0%, rgba(22,104,220,.2) 100%);
}
.timeline-item {
  position: relative;
  padding: 12px 0 12px 16px;
}
.timeline-marker {
  position: absolute;
  left: -30px;
  top: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: #171b28;
  border: 2px solid #2b3145;
  z-index: 1;
  box-shadow: 0 0 0 4px #0a0d16;
}
.timeline-content {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 10px 12px;
  min-width: 200px;
}
.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.timeline-night {
  font-size: 11px;
  color: #1668dc;
  font-weight: 600;
  background: rgba(22,104,220,.15);
  padding: 2px 6px;
  border-radius: 4px;
}
.timeline-label {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.timeline-detail {
  color: #aaa;
  font-size: 12px;
  margin-top: 4px;
}
.detail-target {
  color: #ddd;
  font-weight: 500;
}
.detail-extra {
  color: #888;
  font-size: 11px;
  margin-left: 4px;
}
.timeline-empty {
  text-align: center;
  color: #666;
  padding: 40px 0;
  font-size: 13px;
}

/* ===== 荣誉选择 ===== */
.honor-card {
  margin-bottom: 16px;
}
.honor-card .ant-card-head-title { color: #fff; }
.honor-select { gap: 12px; }

/* ===== 星级认证 ===== */
.star-card {
  margin-bottom: 16px;
}
.star-card .ant-card-head-title { color: #fff; }
.star-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.star-player-info {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  min-width: 100px;
}
.star-rating {
  display: inline-flex;
  gap: 2px;
}
.star {
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s;
  user-select: none;
}
.star:hover { transform: scale(1.2); filter: brightness(1.3); }
.star.filled { color: #ffd666; }
.star:not(.filled) { color: #555; opacity: 0.5; }

/* ===== 一键结算 ===== */
.finish-card {
  margin-top: 16px;
}
.finish-progress {
  text-align: center;
  padding: 24px 16px;
}
.finish-step {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}
.progress-bar {
  height: 8px;
  background: #2b3145;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1668dc 0%, #4ecdc4 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  box-shadow: 0 0 12px rgba(22,104,220,.5);
}
.finish-hint {
  color: #888;
  font-size: 13px;
}

/* 兼容旧样式 */
.small { color: #888; font-size: 12px; }
.row { display: flex; align-items: center; gap: 12px; }
.confirm-grid { display: flex; flex-direction: column; gap: 12px; }
.confirm-item { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.confirm-label { width: 72px; flex: none; color: #999; font-size: 13px; }
.row { display: flex; align-items: center; gap: 12px; }
.small { color: #888; font-size: 12px; }
</style>
