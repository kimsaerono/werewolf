<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { App as AntApp } from "ant-design-vue"
import { getWerewolfGroupMembers } from "@/api/feishu"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, playerCount, maxNeed, actions, refs, activeTab, judgeScore } = props.game

const loading = ref(false)
const loadStatus = ref("")
const memberCache = ref<string[]>([])

const judgePick = ref("")
const customJudge = ref("")

const isAdded = (name: string) => state.players.some((p) => p.name === name)
const isJudge = (name: string) => state.judge === name

/** 名字下拉：不在群（手输名字）放第一项；当前法官选项置灰不可重复选 */
const nameOptions = computed(() => [
  { value: "__OTHER__", label: "🙋 不在群（手输名字）" },
  ...memberCache.value.map((n) => ({ value: n, label: n, disabled: n === state.judge })),
])

function onJudgeSelect(v: string) {
  if (v && v !== "__OTHER__") {
    actions.setJudge(v)
    message.success(`法官已设置为：${v}（不参与游戏，每局 +0.5 分）`)
  }
}
function onJudgeClear() {
  actions.clearJudge()
  judgePick.value = ""
  message.info("已清除法官，该成员可重新参与")
}
function onJudgeCustom() {
  const name = customJudge.value.trim()
  if (!name) return message.error("请输入法官名字")
  actions.setJudge(name)
  customJudge.value = ""
  message.success(`法官已设置为：${name}（不参与游戏，每局 +0.5 分）`)
}
// 法官状态变更时下拉显示始终同步（含刷新后回显）
watch(
  () => state.judge,
  (j) => {
    if (judgePick.value === "__OTHER__") return
    judgePick.value = j || ""
  },
  { immediate: true },
)

const boardRoles = () => refs.getBoardRoles(state)

// 玩家人数与板子人数一致时提示
const enough = computed(() => playerCount.value > 0 && playerCount.value === boardRoles().length)
watch(enough, (v, old) => {
  if (v && !old) message.success(`玩家人数已齐（${playerCount.value} 人），可进入「分配角色」`)
})

const roleGroups = computed(() => {
  const roles = boardRoles()
  const counts: Record<string, number> = {}
  roles.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1
  })
  return Object.entries(counts).map(([role, count]) => ({
    role,
    count,
    canAdd: refs.canAddRole(roles, role),
  }))
})
const remainingRoles = computed(() => refs.ALL_ROLE_OPT.filter((r) => !boardRoles().includes(r)))

const addRoleModal = ref(false)

function setRoles(roles: string[]) {
  const err = actions.setBoardRoles(roles)
  if (err) message.error(err)
}
function addRole(role: string) {
  if (!refs.canAddRole(boardRoles(), role)) {
    message.warning(`角色【${role}】最多 1 个，不能重复添加`)
    return
  }
  setRoles([...boardRoles(), role])
}
function removeRole(role: string) {
  const list = boardRoles()
  const idx = list.indexOf(role)
  if (idx < 0) return
  const next = [...list]
  next.splice(idx, 1)
  setRoles(next)
}
function resetBoardRoles() {
  actions.setBoard(state.board)
  message.info("已重置为默认板子配置")
}

function resetGame() {
  if (confirm("全部重置：玩家、角色、分数、日志、复盘全部清空？")) actions.resetWholeGame()
}

async function loadMembers() {
  loading.value = true
  loadStatus.value = ""
  try {
    memberCache.value = await getWerewolfGroupMembers()
    loadStatus.value = `已获取 ${memberCache.value.length} 名成员`
  } catch (e: unknown) {
    loadStatus.value = `获取成员失败：${(e as Error).message}（请确认后端已启动）`
    message.error(loadStatus.value)
  } finally {
    loading.value = false
  }
}
onMounted(loadMembers)

function addAllPool() {
  const before = playerCount.value
  const added = actions.importPlayers(memberCache.value.filter((n) => !isAdded(n) && !isJudge(n)))
  message.success(`已添加全部 ${added} 人（原有 ${before} 人）`)
}
function confirmPlayers() {
  if (state.players.length === 0) return message.error("还没有玩家参与")
  const need = refs.getBoardRoles(state).length
  if (state.players.length !== need) {
    return message.error(`板子最终 ${need} 人，当前已选 ${state.players.length} 人，一致后才能进入下一步`)
  }
  actions.confirmPlayers()
  message.success(`已确认 ${state.players.length} 名玩家参与，自动进入「分配角色」`)
  activeTab.value = "assign"
}

// ===== 成员多选：tap 点选 / 长按拖动连选 / 拖动滚动 =====
let pressMember = ""
let pressX = 0
let pressY = 0
let touchMoved = false
let longTimer: ReturnType<typeof setTimeout> | null = null
let selecting = false
let mode: "add" | "remove" | null = null
const visited = new Set<string>()

function commitMember(name: string, m: "add" | "remove") {
  if (isJudge(name)) return
  if (m === "add" && !isAdded(name)) {
    if (playerCount.value >= boardRoles().length) {
      message.warning(`玩家人数已够（${boardRoles().length} 人），无需再加`)
      return
    }
    actions.addPlayer(name)
  } else if (m === "remove") {
    const idx = state.players.findIndex((p) => p.name === name)
    if (idx >= 0) actions.delPlayer(idx)
  }
}
function beginSelect(name: string) {
  selecting = true
  mode = isAdded(name) ? "remove" : "add"
  commitMember(name, mode)
}
function memberAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const node = el?.closest?.("[data-member-name]")
  return node ? node.getAttribute("data-member-name") : null
}
function onPoolPointerDown(e: PointerEvent) {
  const name = memberAt(e.clientX, e.clientY)
  if (!name) return
  pressMember = name
  pressX = e.clientX
  pressY = e.clientY
  touchMoved = false
  visited.clear()
  visited.add(name)
  if (e.pointerType === "mouse") {
    beginSelect(name)
  } else {
    if (longTimer) clearTimeout(longTimer)
    longTimer = setTimeout(() => beginSelect(name), 300)
  }
}
function onPoolPointerMove(e: PointerEvent) {
  if (e.pointerType !== "mouse") {
    if (Math.abs(e.clientX - pressX) > 8 || Math.abs(e.clientY - pressY) > 8) touchMoved = true
    if (!selecting && touchMoved) {
      if (longTimer) {
        clearTimeout(longTimer)
        longTimer = null
      }
      return
    }
  }
  if (!selecting || !mode) return
  const name = memberAt(e.clientX, e.clientY)
  if (name && !visited.has(name)) {
    visited.add(name)
    commitMember(name, mode)
  }
}
/** 长按选中期间阻止浏览器滚动，让拖动变成连选；未选中时正常滚动 */
function onPoolTouchMove(e: TouchEvent) {
  if (selecting) e.preventDefault()
}
function onPoolPointerEnd(e: PointerEvent) {
  if (longTimer) {
    clearTimeout(longTimer)
    longTimer = null
  }
  if (!selecting && pressMember) {
    if (e.pointerType === "touch" && !touchMoved) {
      commitMember(pressMember, isAdded(pressMember) ? "remove" : "add")
    }
  }
  selecting = false
  mode = null
  visited.clear()
  pressMember = ""
}
</script>

<template>
  <div class="panel setup-panel">
    <a-card title="🎲 板子与法官" :bordered="false">
      <div class="row" style="margin-top: 0">
        <span class="field-label">板子</span>
        <a-select style="flex: 1; min-width: 220px" :value="state.board" @change="actions.setBoard($event)">
          <a-select-option v-for="(_, key) in refs.boardConfig" :key="key" :value="key">
            {{ refs.boardLabels[key] || key }}
          </a-select-option>
        </a-select>
      </div>

      <a-divider style="margin: 12px 0 8px">角色组合（{{ boardRoles().length }} 人，可微调）</a-divider>
      <div class="role-editor">
        <div v-for="g in roleGroups" :key="g.role" class="role-chip">
          <span class="role-avatar">{{ refs.ROLE_EMOJI[g.role] || "🎭" }}</span>
          <span class="role-chip-name">{{ g.role }}</span>
          <span class="role-chip-count">×{{ g.count }}</span>
          <a-button size="small" type="primary" shape="circle" :disabled="!g.canAdd" class="role-btn" @click="addRole(g.role)">+</a-button>
          <a-button size="small" danger shape="circle" :disabled="boardRoles().length <= 2" class="role-btn" @click="removeRole(g.role)">−</a-button>
        </div>
        <a-space :wrap="true">
          <a-button size="small" type="dashed" @click="addRoleModal = true">＋ 加角色</a-button>
          <a-button size="small" @click="resetBoardRoles">重置默认</a-button>
        </a-space>
      </div>
      <a-divider style="margin: 12px 0" />
      <div class="row">
        <span class="field-label">法官</span>
        <a-select
          v-model:value="judgePick"
          style="flex: 1; min-width: 160px"
          placeholder="选择法官（选中即确认）"
          :options="nameOptions"
          allow-clear
          @change="onJudgeSelect"
          @clear="onJudgeClear"
        />
        <a-input
          v-if="judgePick === '__OTHER__'"
          v-model:value="customJudge"
          placeholder="输入法官名字，回车/失焦确认"
          style="max-width: 180px"
          @change="onJudgeCustom"
        />
        <a-tag v-if="state.judge" color="volcano" closable @close.prevent="onJudgeClear">⚖️ {{ state.judge }}（累计 {{ judgeScore }} 分）</a-tag>
      </div>
    </a-card>

    <a-card :bordered="false">
      <template #title>
        👥 选择参与玩家
        <span class="small">（点选成员加入，法官已除外；已参与 {{ playerCount }} / {{ refs.getBoardRoles(state).length }} 人）</span>
        <a-tag
          v-if="playerCount !== refs.getBoardRoles(state).length"
          color="volcano"
          style="margin-left: 8px"
        >
          ⚠️ 人数不一致，还需 {{ refs.getBoardRoles(state).length - playerCount }} 人
        </a-tag>
        <a-tag v-else color="success" style="margin-left: 8px">✓ 人数一致</a-tag>
      </template>
      <div class="row" style="margin-top: 0">
        <a-button size="small" @click="addAllPool">全选加入</a-button>
        <a-button size="small" :loading="loading" @click="loadMembers">重新拉取群成员</a-button>
        <a-button danger size="small" @click="resetGame">整局重置</a-button>
        <span v-if="loadStatus" class="small">{{ loadStatus }}</span>
      </div>
      <div
        class="member-pool"
        @touchmove="onPoolTouchMove"
        @pointerdown="onPoolPointerDown"
        @pointermove="onPoolPointerMove"
        @pointerup="onPoolPointerEnd"
        @pointerleave="onPoolPointerEnd"
        @pointercancel="onPoolPointerEnd"
      >
        <a-row :gutter="[8, 4]">
          <a-col v-for="n in memberCache" :key="n" :xs="12" :sm="8" :md="6" :lg="4" :xl="3">
            <div
              class="member-item"
              :class="{ added: isAdded(n), judge: isJudge(n) }"
              :data-member-name="n"
            >
              <span class="member-check">{{ isAdded(n) ? "✓" : isJudge(n) ? "⚖️" : "" }}</span>
              {{ n }}<span v-if="isJudge(n)" class="small">（法官）</span>
            </div>
          </a-col>
        </a-row>
      </div>
      <p class="small" style="margin: 6px 0">
        轻点 = 加入/移出；长按拖动 = 批量连选；滑动 = 滚动
      </p>
      <a-divider style="margin: 12px 0">已参与玩家</a-divider>
      <a-space :wrap="true">
        <a-tag v-for="p in state.players" :key="p.name" color="green">
          {{ refs.playerLabel(p) }}
        </a-tag>
      </a-space>
      <div class="row" style="margin-top: 12px">
        <a-button type="primary" size="large" @click="confirmPlayers">
          ✅ 确认参与玩家（{{ state.players.length }} 人）
        </a-button>
        <a-tag v-if="state.playersConfirmed" color="success">已确认参与名单</a-tag>
      </div>
    </a-card>

    <a-modal v-model:open="addRoleModal" title="＋ 加角色（选择剩余角色）" :footer="null" width="360px">
      <p class="small">已有角色用上方「+ / −」调整数量</p>
      <div v-if="remainingRoles.length" class="role-remaining">
        <div v-for="r in remainingRoles" :key="r" class="role-remaining-item" @click="addRole(r)">
          <span>{{ refs.ROLE_EMOJI[r] || "🎭" }} {{ r }}</span>
          <a-tag color="success">添加</a-tag>
        </div>
      </div>
      <a-empty v-else description="已包含全部角色" :image-simple="true" />
    </a-modal>
  </div>
</template>

<style scoped>
.field-label {
  color: #888;
  font-size: 13px;
  white-space: nowrap;
}
</style>
