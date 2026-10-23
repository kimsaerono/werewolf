<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue"
import type { Game } from "@/types"
import VersionSwitcher from "@/components/VersionSwitcher.vue"
import StaticVersionSelector from "@/components/StaticVersionSelector.vue"
import { DEFAULT_BOARD } from "@/game/logic"

const props = defineProps<{ game: Game }>()
const { state, actions } = props.game

const sel = ref<"real" | "sim">(state.simMode ? "sim" : "real")
const entering = ref(false)
const variant = ref<"normal" | "gods">(state.simVariant === "gods" ? "gods" : "normal")
let variantStartX: number | null = null

/** 左右滑动切换：右滑=普通，左滑=诸神之战 */
function onVariantPointerDown(e: PointerEvent) {
  variantStartX = e.clientX
}
function onVariantPointerMove(e: PointerEvent) {
  if (variantStartX === null) return
  const dx = e.clientX - variantStartX
  if (dx > 36) {
    variant.value = "normal"
    variantStartX = null
  } else if (dx < -36) {
    variant.value = "gods"
    variantStartX = null
  }
}
function onVariantPointerUp() {
  variantStartX = null
}

const isLocalHost = computed(() => {
  const hostname = window.location.hostname
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.")
})

const opts = [
  {
    key: "real",
    emoji: "🎯",
    title: "真实对局",
    desc: "数据计入积分与排名，同步飞书",
    details: [
      { label: "积分", value: "计入总分/排名", icon: "📊" },
      { label: "同步", value: "飞书自动同步", icon: "☁️" },
      { label: "排名", value: "参与赛季排名", icon: "🏆" },
      { label: "适用", value: "正式比赛/积分局", icon: "🎪" },
    ]
  },
  {
    key: "sim",
    emoji: "🧪",
    title: "模拟对局",
    desc: "仅本地记录，不影响排名",
    details: [
      { label: "积分", value: "不计入总分", icon: "📊" },
      { label: "同步", value: "仅本地保存", icon: "💾" },
      { label: "排名", value: "不参与排名", icon: "🚫" },
      { label: "适用", value: "练习/娱乐/测试", icon: "🏠" },
    ]
  }
] as const

const cardRefs = ref<(HTMLElement | null)[]>([])
let particleAnimationId: number | null = null
let particleCanvas: HTMLCanvasElement | null = null
let stopParticles: (() => void) | null = null
let enterTimer: ReturnType<typeof setTimeout> | null = null

function enter() {
  if (entering.value) return
  entering.value = true
  const isSim = sel.value === "sim"
  const prevVariant = state.simVariant
  actions.setSimMode(isSim)
  if (!isSim) {
    // 真实对局只走普通模式；从诸神之战切回时恢复默认板子/屠边
    if (prevVariant === "gods") {
      actions.setSimVariant("normal")
      actions.setWinMode("edge")
      actions.setBoard(DEFAULT_BOARD)
    }
  } else {
    actions.setSimVariant(variant.value)
    if (variant.value === "gods") {
      // 诸神之战：默认屠城（仍允许在板子页手动切换）
      actions.setWinMode("city")
    } else if (prevVariant === "gods") {
      // 切回普通模拟：恢复默认板子和屠边
      actions.setWinMode("edge")
      actions.setBoard(DEFAULT_BOARD)
    }
  }
  // 先播 800ms 的成功涟漪，再切到下一步；重复调用 setModeChosen 会让涟漪根本看不见
  enterTimer = setTimeout(() => {
    entering.value = false
    actions.setModeChosen(true)
  }, 800)
}

function handleCardClick(key: "real" | "sim") {
  sel.value = key
  if (navigator.vibrate) navigator.vibrate(50)
}

onMounted(() => {
  stopParticles = initParticles()
})

onBeforeUnmount(() => {
  if (enterTimer) clearTimeout(enterTimer)
  if (stopParticles) stopParticles()
})

function initParticles(): (() => void) | null {
  const container = document.querySelector('.mode-page') as HTMLElement
  if (!container) return null

  particleCanvas = document.createElement('canvas')
  particleCanvas.style.position = 'fixed'
  particleCanvas.style.top = '0'
  particleCanvas.style.left = '0'
  particleCanvas.style.width = '100%'
  particleCanvas.style.height = '100%'
  particleCanvas.style.pointerEvents = 'none'
  particleCanvas.style.zIndex = '0'
  container.insertBefore(particleCanvas, container.firstChild)

  const particles: Particle[] = []
  const particleCount = 60

  function resize() {
    if (!particleCanvas) return
    particleCanvas.width = window.innerWidth
    particleCanvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1
    })
  }

  function animate() {
    if (!particleCanvas) return
    const ctx = particleCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height)

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy

      if (p.x < 0) p.x = window.innerWidth
      if (p.x > window.innerWidth) p.x = 0
      if (p.y < 0) p.y = window.innerHeight
      if (p.y > window.innerHeight) p.y = 0

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(22, 104, 220, ${p.opacity})`
      ctx.fill()
    }

    particleAnimationId = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    window.removeEventListener('resize', resize)
    if (particleAnimationId) cancelAnimationFrame(particleAnimationId)
    particleAnimationId = null
    particleCanvas?.remove()
    particleCanvas = null
  }
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
}
</script>

<template>
  <div class="mode-page">
    <div class="mode-version">
      <StaticVersionSelector v-if="!isLocalHost" />
      <VersionSwitcher v-else />
    </div>
    <div class="mode-hero">
      <div class="mode-logo">🐺</div>
      <h1 class="mode-title">狼人杀法官助手</h1>
      <p class="mode-sub">请先选择对局模式，再进入助手</p>
    </div>

    <div class="mode-cards">
      <div
        v-for="o in opts"
        :key="o.key"
        class="mode-card"
        :class="[`mode-card-${o.key}`, { active: sel === o.key, entering: entering && sel === o.key }]"
        @click="handleCardClick(o.key)"
        ref="cardRefs"
      >
        <div class="mode-card-emoji">{{ o.emoji }}</div>
        <div class="mode-card-title">{{ o.title }}</div>
        <div class="mode-card-desc">{{ o.desc }}</div>

        <!-- 对比详情：横向紧凑 -->
        <div class="mode-card-details" v-if="sel === o.key">
          <div class="detail-row" v-for="d in o.details" :key="d.label">
            <span class="detail-icon">{{ d.icon }}</span>
            <span class="detail-label">{{ d.label }}</span>
            <span class="detail-value">{{ d.value }}</span>
          </div>
        </div>

        <div
          v-if="o.key === 'sim' && sel === 'sim'"
          class="sim-variant"
          @click.stop
          @pointerdown.stop="onVariantPointerDown"
          @pointermove.stop="onVariantPointerMove"
          @pointerup.stop="onVariantPointerUp"
          @pointercancel.stop="onVariantPointerUp"
        >
          <div class="sim-variant-track" :class="{ gods: variant === 'gods' }">
            <span class="sim-variant-thumb"></span>
            <button type="button" class="sim-variant-opt" :class="{ active: variant === 'normal' }" @click.stop="variant = 'normal'">普通模拟</button>
            <button type="button" class="sim-variant-opt" :class="{ active: variant === 'gods' }" @click.stop="variant = 'gods'">诸神之战</button>
          </div>
          <div class="sim-variant-hint">{{ variant === "gods" ? "角色可自定义 · 固定屠城 · 第三方仍须清零" : "标准板子 · 默认屠边" }}</div>
        </div>

        <div class="mode-card-check">{{ sel === o.key ? "● 已选择" : "○ 点击选择" }}</div>
      </div>
    </div>

    <a-button
      type="primary"
      size="large"
      class="mode-enter"
      @click="enter"
      :loading="entering"
    >
      <span v-if="!entering">进入助手</span>
      <span v-else>正在进入...</span>
    </a-button>
  </div>
</template>

<style scoped>
.mode-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 24px 16px;
  background: linear-gradient(180deg, #0a0d16 0%, #101a2e 100%);
  text-align: center;
  position: relative;
  overflow: hidden;
}
.mode-version {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}
.mode-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
}
.mode-logo {
  font-size: 64px;
  line-height: 1;
  animation: float 3s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.mode-title {
  margin: 0;
  color: #fff;
  font-size: 28px;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #fff 0%, #1668dc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.mode-sub {
  margin: 0;
  color: #999;
  font-size: 14px;
}
.mode-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  max-width: 720px;
  width: 100%;
  z-index: 1;
}
.mode-card {
  flex: 1 1 260px;
  max-width: 340px;
  background: #171b28;
  border: 2px solid #2b3145;
  border-radius: 16px;
  padding: 20px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.15s;
  position: relative;
  overflow: hidden;
}
.mode-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(22,104,220,0.1) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 14px;
  pointer-events: none;
}
.mode-card:hover {
  border-color: #3a4466;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0,0,0,.3);
}
.mode-card:hover::before { opacity: 1; }
.mode-card.active {
  transform: scale(1.02);
}
.mode-card.active::before { opacity: 1; }
.mode-card.entering {
  animation: enterPulse 0.6s ease-out;
}
@keyframes enterPulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22,104,220,0.4); }
  50% { transform: scale(1.03); box-shadow: 0 0 24px 8px rgba(22,104,220,0.3); }
  100% { transform: scale(1.02); box-shadow: 0 0 24px 4px rgba(22,104,220,0.2); }
}
.mode-card-real.active {
  border-color: #1668dc;
  background: #1668dc14;
  box-shadow: 0 0 24px 4px rgba(22,104,220,0.2);
}
.mode-card-sim.active {
  border-color: #2e7d32;
  background: #2e7d3214;
  box-shadow: 0 0 24px 4px rgba(46,125,50,0.2);
}
.mode-card-emoji {
  font-size: 44px;
  line-height: 1;
  transition: transform 0.2s;
}
.mode-card:hover .mode-card-emoji { transform: scale(1.1) rotate(-5deg); }
.mode-card-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}
.mode-card-desc {
  font-size: 12px;
  color: #bbb;
  line-height: 1.5;
  min-height: 36px;
}
.mode-card-details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,.08);
  width: 100%;
  animation: slideDown 0.2s ease-out;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}
.detail-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,.04); }
.detail-icon { font-size: 12px; flex-shrink: 0; width: 18px; text-align: center; }
.detail-label { color: #888; font-size: 11px; flex-shrink: 0; width: 44px; }
.detail-value { color: #ddd; font-size: 11px; font-weight: 500; flex: 1; text-align: right; }
.sim-variant {
  width: 100%;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  touch-action: none;
}
.sim-variant-track {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 280px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.sim-variant-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  border-radius: 999px;
  background: linear-gradient(135deg, #1668dc, #7a4dff);
  box-shadow: 0 2px 10px rgba(60, 100, 255, 0.45);
  transition: transform 0.22s ease;
}
.sim-variant-track.gods .sim-variant-thumb {
  transform: translateX(100%);
}
.sim-variant-opt {
  position: relative;
  z-index: 1;
  background: none;
  border: 0;
  color: #cbd3e7;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 4px;
  cursor: pointer;
}
.sim-variant-opt.active {
  color: #fff;
}
.sim-variant-hint {
  font-size: 11px;
  color: #8f9ab5;
  line-height: 1.4;
}
.mode-card-check {
  font-size: 12px;
  color: #66bb6a;
  margin-top: 6px;
}
.mode-enter {
  height: 48px;
  min-width: 200px;
  font-size: 16px;
  transition: all 0.2s;
}
.mode-enter:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(22,104,220,.4);
}
.mode-enter:active { transform: scale(0.98); }

/* 手机端：压缩到一屏 */
@media (max-width: 480px) {
  .mode-page {
    gap: 16px;
    padding: 16px 12px;
  }
  .mode-hero {
    gap: 4px;
  }
  .mode-logo {
    font-size: 48px;
  }
  .mode-title {
    font-size: 22px;
  }
  .mode-sub {
    font-size: 12px;
  }
  .mode-cards {
    gap: 8px;
  }
  .mode-card {
    flex: 1 1 100%;
    max-width: 100%;
    padding: 16px 12px;
    gap: 6px;
  }
  .mode-card-emoji {
    font-size: 36px;
  }
  .mode-card-title {
    font-size: 18px;
  }
  .mode-card-desc {
    font-size: 11px;
    min-height: 28px;
  }
  .mode-card-details {
    margin-top: 6px;
    padding-top: 6px;
  }
  .detail-row {
    gap: 6px;
    padding: 3px 0;
    font-size: 10px;
  }
  .detail-icon { font-size: 11px; width: 16px; }
  .detail-label { font-size: 10px; width: 40px; }
  .detail-value { font-size: 10px; }
  .mode-card-check {
    font-size: 11px;
    margin-top: 4px;
  }
  .mode-enter {
    height: 44px;
    min-width: 180px;
    font-size: 15px;
    width: 100%;
    max-width: 280px;
  }
}
</style>