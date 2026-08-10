<script setup lang="ts">
import { computed, ref } from "vue"
import { App as AntApp } from "ant-design-vue"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, actions, refs, activeTab } = props.game

const roleGroups = computed(() => {
  const roles = refs.getBoardRoles(state)
  const counts: Record<string, number> = {}
  roles.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1
  })
  const arr = Object.entries(counts).map(([role, count]) => ({ role, count }))
  return arr.sort((a, b) => (a.role === "平民" ? 1 : b.role === "平民" ? -1 : 0))
})

function occupantOf(role: string, slotIndex: number): string {
  const occupants = state.players.filter((p) => p.role === role)
  return occupants[slotIndex]?.name || ""
}

// ===== 批量选择弹窗（v35） =====
const assignModal = ref(false)
const assignRole = ref("")
const assignSel = ref<string[]>([])
const assignCount = computed(() => roleGroups.value.find((g) => g.role === assignRole.value)?.count || 0)

function openAssign(role: string) {
  assignRole.value = role
  assignSel.value = state.players.filter((p) => p.role === role).map((p) => p.name)
  assignModal.value = true
}
function confirmAssign() {
  const role = assignRole.value
  if (assignSel.value.length > assignCount.value) {
    return message.error(`角色【${role}】最多 ${assignCount.value} 人，当前选了 ${assignSel.value.length} 人`)
  }
  // 先清掉本角色下未选中的玩家
  state.players
    .filter((p) => p.role === role && !assignSel.value.includes(p.name))
    .forEach((p) => actions.setRole(state.players.indexOf(p), ""))
  // 再分配选中的玩家
  let added = 0
  for (const n of assignSel.value) {
    const idx = state.players.findIndex((p) => p.name === n)
    if (idx >= 0 && actions.setRole(idx, role) === null) added++
  }
  assignModal.value = false
  message.success(`已分配 ${added} 人到【${role}】`)
  // 其他角色选齐后，自动把剩余未分配玩家填入平民
  autoFillCivilIfReady()
}

/** 当除平民外所有角色都选满时，自动把剩余未分配玩家填充到平民（v32） */
function autoFillCivilIfReady() {
  const nonCivil = roleGroups.value.filter((g) => g.role !== "平民")
  const allNonCivilFull = nonCivil.every(
    (g) => state.players.filter((p) => p.role === g.role).length === g.count,
  )
  const civil = roleGroups.value.find((g) => g.role === "平民")
  if (!allNonCivilFull || !civil) return
  const civilCount = state.players.filter((p) => p.role === "平民").length
  if (civilCount >= civil.count) return
  const unassigned = state.players.filter((p) => !p.role)
  const need = civil.count - civilCount
  const fill = unassigned.slice(0, need)
  for (const p of fill) {
    const idx = state.players.indexOf(p)
    actions.setRole(idx, "平民")
  }
  if (fill.length) {
    message.success(`其余角色已选齐，自动填充 ${fill.length} 名玩家到平民`)
  }
}

// ===== 自动分配平民（v32） =====
function autoCivil() {
  const quota = roleGroups.value.find((g) => g.role === "平民")?.count || 0
  const current = state.players.filter((p) => p.role === "平民").length
  if (current >= quota) return message.warning("平民槽位已满")
  let added = 0
  for (const p of state.players) {
    if (current + added >= quota) break
    if (p.role) continue
    const idx = state.players.indexOf(p)
    if (actions.setRole(idx, "平民") === null) added++
  }
  message.success(`已自动把 ${added} 名未分配玩家设为平民`)
}

const dragIdx = ref(-1)
function onDrop(to: number) {
  const from = dragIdx.value
  dragIdx.value = -1
  if (from < 0 || from === to) return
  actions.movePlayer(from, to)
}

function startGame() {
  const err = actions.manualSaveRoles()
  if (err) {
    message.error(err)
    return
  }
  message.success("游戏已开始，本局角色已锁定！")
  activeTab.value = "game"
}
</script>

<template>
  <div class="panel setup-panel">
    <a-card title="🎯 给角色分配人（点击角色框批量选择）" :bordered="false">
      <p class="small" style="margin-top: 0">
        点任意角色框唤起已签到玩家多选弹窗，选择时即按名额限制；其他角色选齐后，剩余玩家会自动填充到平民。
      </p>
      <a-empty v-if="state.players.length === 0" description="还没有玩家，请到「板子与选人」选择玩家" />
      <a-row v-else :gutter="[12, 12]">
        <a-col v-for="g in roleGroups" :key="g.role" :xs="24" :sm="12" :lg="8">
          <div class="role-assign-card" @click="openAssign(g.role)">
            <div class="role-assign-title">
              <span class="role-avatar">{{ refs.ROLE_EMOJI[g.role] || "🎭" }}</span>
              <b>{{ g.role }}</b>
              <span class="small">×{{ g.count }}</span>
              <span class="flex-spacer"></span>
              <a-tag :color="state.players.filter((p) => p.role === g.role).length >= g.count ? 'success' : 'warning'">
                {{ state.players.filter((p) => p.role === g.role).length }}/{{ g.count }}
              </a-tag>
              <a-button size="small" type="dashed">批量选人</a-button>
            </div>
            <div v-for="s in g.count" :key="s" class="role-slot">
              <span v-if="occupantOf(g.role, s - 1)" class="slot-name">{{ refs.playerLabel(state.players.find((p) => p.name === occupantOf(g.role, s - 1))!) }}</span>
              <span v-else class="slot-empty">未分配</span>
            </div>
          </div>
        </a-col>
      </a-row>
      <div class="row" style="margin-top: 10px">
        <a-button @click="autoCivil">⚙️ 自动匹配剩余玩家为平民</a-button>
        <a-tag color="blue">板子需 {{ refs.getBoardRoles(state).length }} 人，已选 {{ state.players.length }} 人</a-tag>
      </div>
    </a-card>

    <a-card title="👥 已签到玩家（可拖动排序，按编号入座）" :bordered="false">
      <a-empty v-if="state.players.length === 0" description="暂无玩家" />
      <div
        v-for="(p, idx) in state.players"
        :key="p.name"
        class="signed-row"
        :class="{ dragging: dragIdx === idx }"
        draggable="true"
        @dragstart="dragIdx = idx"
        @dragend="dragIdx = -1"
        @dragover.prevent
        @drop="onDrop(idx)"
      >
        <span class="seat-no">{{ p.no || idx + 1 }}</span>
        <span class="role-avatar small">{{ refs.ROLE_EMOJI[p.role] || "" }}</span>
        <span class="signed-name">{{ p.name }}</span>
        <span v-if="p.role" class="small" style="color: #4ec9ff">{{ p.role }}</span>
        <span class="flex-spacer"></span>
        <a-button size="small" :disabled="idx === 0" @click="actions.movePlayer(idx, idx - 1)">↑</a-button>
        <a-button size="small" :disabled="idx === state.players.length - 1" @click="actions.movePlayer(idx, idx + 1)">↓</a-button>
      </div>
      <p class="small" style="margin-top: 8px">桌面端可直接拖动行调整顺序（顺序即座位号）；手机可用 ↑↓ 按钮</p>
    </a-card>

    <div class="start-game-bar">
      <a-button type="primary" size="large" block style="height: 48px; font-size: 17px" @click="startGame">
        🚀 开始游戏
      </a-button>
    </div>

    <a-modal v-model:open="assignModal" :title="`批量分配：【${assignRole}】（${assignSel.length}/${assignCount}）`" :footer="null" width="420px">
      <p class="small">按已签到顺序显示；勾选要分配到该角色的玩家（选满 {{ assignCount }} 人后自动禁用）</p>
      <a-checkbox-group v-model:value="assignSel" style="width: 100%">
        <div v-for="p in state.players" :key="p.name" class="assign-item">
          <a-checkbox
            :value="p.name"
            :disabled="!assignSel.includes(p.name) && assignSel.length >= assignCount"
          >
            {{ refs.playerLabel(p) }}<span v-if="p.role && p.role !== assignRole" class="small" style="color:#ffa502">（当前{{ p.role }}，将改派）</span>
          </a-checkbox>
        </div>
      </a-checkbox-group>
      <div class="row" style="margin-top: 12px">
        <a-button type="primary" block @click="confirmAssign">确认分配</a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.role-assign-card {
  background: #1d2233;
  border: 1px solid #333c55;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.role-assign-card:hover {
  border-color: #2ed573;
  background: #2ed57310;
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
.role-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
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
.slot-name {
  font-size: 14px;
}
.slot-empty {
  color: #666;
  font-size: 13px;
}
.assign-item {
  padding: 6px 4px;
  border-bottom: 1px solid #22283a;
}
.flex-spacer {
  flex: 1;
}
</style>
