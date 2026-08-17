<script setup lang="ts">
import { ref } from "vue"
import type { Game } from "@/types"

const props = defineProps<{ game: Game }>()
const { state, actions } = props.game

const sel = ref<"real" | "sim">(state.simMode ? "sim" : "real")

const opts = [
  { key: "real", emoji: "🎯", title: "真实对局", desc: "数据将同步到飞书表格，计入积分与排名", tag: "同步飞书" },
  { key: "sim", emoji: "🧪", title: "模拟对局", desc: "本局数据不会同步到飞书，仅本地记录", tag: "不同步" },
] as const

function enter() {
  actions.setSimMode(sel.value === "sim")
  actions.setModeChosen(true)
}
</script>

<template>
  <div class="mode-page">
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
        :class="[`mode-card-${o.key}`, { active: sel === o.key }]"
        @click="sel = o.key"
      >
        <div class="mode-card-emoji">{{ o.emoji }}</div>
        <div class="mode-card-title">
          {{ o.title }}
          <a-tag :color="o.key === 'real' ? '#1668dc' : '#2e7d32'" style="margin-left: 6px">{{ o.tag }}</a-tag>
        </div>
        <div class="mode-card-desc">{{ o.desc }}</div>
        <div class="mode-card-check">{{ sel === o.key ? "● 已选择" : "○" }}</div>
      </div>
    </div>

    <a-button type="primary" size="large" class="mode-enter" @click="enter">
      进入助手
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
}
.mode-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.mode-logo {
  font-size: 64px;
  line-height: 1;
}
.mode-title {
  margin: 0;
  color: #fff;
  font-size: 28px;
  letter-spacing: 1px;
}
.mode-sub {
  margin: 0;
  color: #999;
  font-size: 14px;
}
.mode-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  max-width: 720px;
  width: 100%;
}
.mode-card {
  flex: 1 1 260px;
  max-width: 340px;
  background: #171b28;
  border: 2px solid #2b3145;
  border-radius: 16px;
  padding: 24px 20px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: border-color 0.2s, background 0.2s, transform 0.1s;
}
.mode-card:hover {
  border-color: #3a4466;
}
.mode-card-real.active {
  border-color: #1668dc;
  background: #1668dc14;
}
.mode-card-sim.active {
  border-color: #2e7d32;
  background: #2e7d3214;
}
.mode-card-emoji {
  font-size: 44px;
  line-height: 1;
}
.mode-card-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}
.mode-card-desc {
  font-size: 13px;
  color: #bbb;
  line-height: 1.6;
  min-height: 40px;
}
.mode-card-check {
  font-size: 13px;
  color: #66bb6a;
}
.mode-enter {
  height: 52px;
  min-width: 220px;
  font-size: 18px;
}
</style>