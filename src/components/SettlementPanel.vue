<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import type { Game } from "@/types"
import type { Player } from "@/game/logic"
import { ROLE_EMOJI, roleShort } from "@/game/logic"
import { roleAvatar } from "@/assets/roles"
import { createHonors, toggleHonor, type HonorType } from "@/utils/honor"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ done: [] }>()
const { state, actions, refs, winNotice } = props.game

const honors = reactive(createHonors())
const submitting = ref(false)

const HONOR_META: { key: HonorType; icon: string; label: string }[] = [
  { key: "mvp", icon: "🏆", label: "MVP" },
  { key: "svp", icon: "🥈", label: "SVP" },
  { key: "beiguo", icon: "🐑", label: "背锅" },
]

const title = computed(() => winNotice.value?.text || "本局结束")
const suggestion = computed(() => refs.suggestHonor(state))
const suggestionText = computed(() => {
  const parts: string[] = []
  if (suggestion.value.mvp) parts.push(`MVP ${suggestion.value.mvp}`)
  if (suggestion.value.svp) parts.push(`SVP ${suggestion.value.svp}`)
  return parts.join("，")
})

function adoptSuggestion() {
  if (!suggestionText.value) {
    message.info("本局没有可采用的自动建议")
    return
  }
  honors.mvp = suggestion.value.mvp
  honors.svp = suggestion.value.svp
  if (honors.beiguo === honors.mvp || honors.beiguo === honors.svp) honors.beiguo = ""
}

function isPicked(p: Player, key: HonorType) {
  return honors[key] === p.name
}

function pick(p: Player, key: HonorType) {
  toggleHonor(honors, key, p.name)
}

function avatarOf(role: string) {
  return roleAvatar(role)
}

const summaryText = computed(() =>
  HONOR_META.map((m) => `${m.icon}${m.label}：${honors[m.key] || "未选"}`).join(" ｜ "),
)

function submit() {
  if (submitting.value) return
  submitting.value = true
  const err = actions.commitHonors(honors.mvp, honors.svp, honors.beiguo)
  if (err) {
    submitting.value = false
    message.error(err)
    return
  }
  emit("done")
}
</script>

<template>
  <div class="settle-panel">
    <div class="settle-head">
      <div class="settle-emoji">🏆</div>
      <h2 class="settle-title">{{ title }}</h2>
      <p class="settle-reason">原因：{{ winNotice?.reason }}</p>
      <pre class="settle-camps">{{ winNotice?.camps }}</pre>
      <p v-if="state.simMode" class="settle-mode">🧪 模拟模式</p>
    </div>

    <div v-if="state.winCamp" class="settle-body">
      <div class="settle-honor">
        <div class="settle-honor-head">
          <span>🏆 点座位选本局荣誉（可选，计入积分）</span>
          <a-button size="small" :disabled="!suggestionText" @click="adoptSuggestion">采用自动建议</a-button>
        </div>
        <p class="settle-suggest">💡 自动建议：{{ suggestionText || "本局无突出者" }}</p>

        <div class="settle-grid">
          <div
            v-for="p in state.players"
            :key="p.name"
            class="settle-seat"
            :class="{ dead: !p.alive }"
          >
            <div class="settle-seat-top">
              <img v-if="avatarOf(p.role)" :src="avatarOf(p.role)" class="settle-avatar-img" :alt="p.role" />
              <span v-else class="settle-avatar-emoji">{{ ROLE_EMOJI[p.role] || "🎭" }}</span>
              <div class="settle-seat-meta">
                <div class="settle-seat-name">
                  <span class="settle-seat-no">{{ p.no || "?" }}</span>{{ p.name }}
                </div>
                <div class="settle-seat-role">{{ refs.thirdCampLabel(state, p) || roleShort(p.role) }}</div>
              </div>
              <span v-if="!p.alive" class="settle-out">OUT</span>
            </div>
            <div class="settle-honor-btns">
              <button
                v-for="m in HONOR_META"
                :key="m.key"
                type="button"
                class="honor-chip"
                :class="[m.key, { active: isPicked(p, m.key) }]"
                @click="pick(p, m.key)"
              >
                {{ m.icon }}{{ m.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="settle-summary">{{ summaryText }}</div>
      </div>
    </div>

    <div class="settle-footer">
      <p class="settle-note">
        已自动结算并保存本局积分与日志{{ state.simMode ? "" : "，点「完成结算」后本局（含荣誉）自动同步飞书" }}
      </p>
      <a-button type="primary" size="large" block :loading="submitting" :disabled="submitting" @click="submit">
        完成结算
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.settle-panel {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 140px);
  text-align: center;
  padding: 2px 0;
}
.settle-head {
  flex: none;
}
.settle-emoji {
  font-size: 48px;
  line-height: 1;
}
.settle-title {
  margin: 6px 0 4px;
  color: #ff6464;
  font-size: 26px;
}
.settle-reason {
  color: #ddd;
  margin: 0 0 8px;
}
.settle-camps {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  line-height: 1.8;
  color: #eee;
  white-space: pre-wrap;
  max-height: 20vh;
  overflow-y: auto;
  margin: 0 0 8px;
}
.settle-mode {
  color: #66bb6a;
  margin: 4px 0 0;
  font-size: 12px;
}
.settle-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  text-align: left;
  margin-top: 10px;
}
.settle-honor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.settle-honor-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #ddd;
  font-size: 13px;
}
.settle-suggest {
  flex: none;
  color: #ffd666;
  font-size: 12px;
  margin: 6px 0 8px;
}
.settle-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  overflow-y: auto;
  padding: 2px;
  overscroll-behavior: contain;
}
.settle-seat {
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 8px;
}
.settle-seat.dead {
  opacity: 0.72;
}
.settle-seat-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.settle-avatar-img {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.settle-avatar-emoji {
  width: 34px;
  height: 34px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #232a3d;
  font-size: 20px;
}
.settle-seat-meta {
  min-width: 0;
  flex: 1;
}
.settle-seat-name {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.settle-seat-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-right: 4px;
  border-radius: 50%;
  background: #2a2e40;
  color: #bbb;
  font-size: 11px;
}
.settle-seat-role {
  color: #888;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.settle-out {
  color: #ff6464;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #ff646466;
  border-radius: 4px;
  padding: 1px 4px;
}
.settle-honor-btns {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.honor-chip {
  flex: 1;
  min-width: 0;
  padding: 4px 2px;
  border-radius: 6px;
  border: 1px solid #333c55;
  background: #1d2233;
  color: #aaa;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.honor-chip:hover {
  border-color: #5a6a99;
  color: #ddd;
}
.honor-chip.active.mvp {
  background: #4a3a08;
  border-color: #ffd666;
  color: #ffd666;
}
.honor-chip.active.svp {
  background: #0f2f4a;
  border-color: #69c0ff;
  color: #69c0ff;
}
.honor-chip.active.beiguo {
  background: #4a1414;
  border-color: #ff7875;
  color: #ff7875;
}
.settle-summary {
  flex: none;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1d2233;
  border: 1px solid #333c55;
  color: #ddd;
  font-size: 12px;
  text-align: center;
}
.settle-footer {
  flex: none;
}
.settle-note {
  color: #888;
  font-size: 12px;
  margin: 10px 0;
}
@media (max-width: 560px) {
  .settle-grid {
    grid-template-columns: 1fr;
  }
  .settle-title {
    font-size: 22px;
  }
}
</style>
