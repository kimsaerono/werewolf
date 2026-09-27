<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { App as AntApp } from "ant-design-vue"
import { getWerewolfGroupMembers } from "@/api/feishu"
import SeatBoard from "@/components/SeatBoard.vue"
import { DEFAULT_BOARD, roleShort } from "@/game/logic"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, playerCount, maxNeed, actions, refs, activeTab } = props.game

const loading = ref(false)
const loadStatus = ref("")
const memberCache = ref<string[]>([])

const isAdded = (name: string) => state.players.some((p) => p.name === name)
/** 已选成员在成员池里显示的号码 = 该玩家的座位号（Player.no，与座位牌一致） */
const playerNo = (name: string) => state.players.find((p) => p.name === name)?.no
const isJudge = (name: string) => state.judge === name

/** 成员池：群成员（去重，接口可能返回重复名字）；法官也留在池里（带 ⚖️ 标识），双击即可设为/取消法官 */
const poolMembers = computed(() => [...new Set<string>(memberCache.value)])

/** 设为/取消法官（双击成员卡触发）。setJudge 内部会把该人从参与玩家中移除 */
function toggleJudge(name: string) {
  if (state.judge === name) {
    actions.clearJudge()
    message.info(`已取消 ${name} 的法官，请重新指定（法官为必填项）`)
    return
  }
  const oldJudge = state.judge
  const wasPlayer = isAdded(name)
  actions.setJudge(name)
  const notes = [wasPlayer ? "已从参与玩家中移除" : ""]
  if (oldJudge) notes.push(`原法官 ${oldJudge} 已卸任`)
  message.success(`⚖️ 宣誓法官：${name}${notes.filter(Boolean).length ? `（${notes.filter(Boolean).join("，")}）` : ""}`)
}

const boardRoles = () => refs.getBoardRoles(state)

// 玩家人数与板子人数一致时提示
const enough = computed(() => playerCount.value > 0 && playerCount.value === boardRoles().length)
watch(enough, (v, old) => {
  if (v && !old) message.success(`玩家人数已齐（${playerCount.value} 人），可进入「对局操作」`)
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

/** 胜负模式选项 */
const winModeOptions = [
  { value: "edge", icon: "🏙️", title: "屠边", desc: "神或民任一全灭狼胜（默认）" },
  { value: "city", icon: "🏘️", title: "屠城", desc: "神与民全灭狼胜" },
] as const

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
  actions.setBoard(DEFAULT_BOARD)
  message.info(`已重置为默认板子（${refs.boardLabels[DEFAULT_BOARD]}）`)
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

/** 当前板子实际角色组成（含手动加的角色）：角色×数量 */
/** 确认弹窗里的胜负模式文案，与 winModeOptions 保持同源，避免两处各写一份 */
const winModeText = computed(() => {
  const m = winModeOptions.find((o) => o.value === state.winMode) || winModeOptions[0]
  return `${m.icon} ${m.title} · ${m.desc.replace("（默认）", "")}`
})
const boardSummaryText = computed(() => {
  const roles = refs.getBoardRoles(state)
  const counts: Record<string, number> = {}
  roles.forEach((r) => (counts[r] = (counts[r] || 0) + 1))
  return Object.entries(counts)
    .map(([role, n]) => `${refs.ROLE_EMOJI[role] || ""}${roleShort(role)}×${n}`)
    .join(" ")
})
onMounted(loadMembers)

function confirmPlayers() {
  if (!state.judge) return message.error("请先选择法官")
  if (state.players.length === 0) return message.error("还没有玩家参与")
  const need = refs.getBoardRoles(state).length
  if (state.players.length !== need) {
    return message.error(`板子最终 ${need} 人，当前已选 ${state.players.length} 人，一致后才能进入下一步`)
  }
  confirmModal.value = true
}
const confirmModal = ref(false)
function doConfirmPlayers() {
  confirmModal.value = false
  actions.confirmPlayers()
  message.success(`已确认 ${state.players.length} 名玩家参与，进入「对局操作」发牌开局`)
  activeTab.value = "game"
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

function commitMember(name: string, m: "add" | "remove", silent = false) {
  if (isJudge(name)) return
  if (m === "add" && !isAdded(name)) {
    if (playerCount.value >= boardRoles().length) {
      if (!silent) message.warning(`玩家人数已够（${boardRoles().length} 人），无需再加`)
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
  // 鼠标和触摸统一走 300ms 定时器：到点才提交并进入连选模式。
  // 这样「快速点击」不会在 pointerdown 就落库，留给双击判定。
  if (longTimer) clearTimeout(longTimer)
  longTimer = setTimeout(() => beginSelect(name), 300)
}
function onPoolPointerMove(e: PointerEvent) {
  if (Math.abs(e.clientX - pressX) > 8 || Math.abs(e.clientY - pressY) > 8) touchMoved = true
  if (!selecting && touchMoved) {
    if (longTimer) {
      clearTimeout(longTimer)
      longTimer = null
    }
    return
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

/** 双击（双击触控）= 设为/取消法官；轻点 = 加入/移出玩家 */
const DBL_TAP_MS = 320
let lastTapName = ""
let lastTapTime = 0
function handleTap(name: string) {
  const now = Date.now()
  if (lastTapName === name && now - lastTapTime < DBL_TAP_MS) {
    lastTapName = ""
    lastTapTime = 0
    // 第一次轻点已经把成员状态翻转过一次，这里静默翻回来，
    // 两次操作在同一个 tick 内完成，用户只会看到「变成法官」，不会有中间态闪烁。
    commitMember(name, isAdded(name) ? "remove" : "add", true)
    toggleJudge(name)
    return
  }
  lastTapName = name
  lastTapTime = now
  commitMember(name, isAdded(name) ? "remove" : "add")
}
function onPoolPointerEnd(e: PointerEvent) {
  if (longTimer) {
    clearTimeout(longTimer)
    longTimer = null
  }
  // 没进过连选模式、且指针没离开原位 → 视为轻点/点击，走双击判定
  if (!selecting && pressMember && !touchMoved) handleTap(pressMember)
  else if (pressMember) {
    lastTapName = ""
    lastTapTime = 0
  }
  selecting = false
  mode = null
  visited.clear()
  pressMember = ""
}
</script>

<template>
  <div class="panel setup-panel">
    <a-card :bordered="false">
      <div class="setup-section">

        <div class="section-divider">⚔️ 胜负模式</div>
        <div class="win-mode-tabs">
          <button
            v-for="m in winModeOptions"
            :key="m.value"
            class="win-mode-tab"
            :class="{ active: state.winMode === m.value }"
            @click="actions.setWinMode(m.value)"
          >
            <span class="win-mode-icon">{{ m.icon }}</span>
            <div class="win-mode-text">
              <span class="win-mode-title">{{ m.title }}</span>
              <span class="win-mode-desc">{{ m.desc }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="section-divider">角色组合（{{ boardRoles().length }} 人，可微调）</div>
      <div class="role-editor">
        <div v-for="g in roleGroups" :key="g.role" class="role-chip">
          <img v-if="refs.roleAvatar(g.role)" class="role-avatar-img" :src="refs.roleAvatar(g.role)" :alt="g.role" />
          <span v-else class="role-avatar">{{ refs.ROLE_EMOJI[g.role] || "🎭" }}</span>
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
    </a-card>

    <a-card :bordered="false">
      <template #title>
        <div class="pool-title">
          <span>选玩家</span>
          <span class="small">({{ playerCount }} / {{ refs.getBoardRoles(state).length }})</span>
          <a-tag
            v-if="playerCount !== refs.getBoardRoles(state).length"
            color="volcano"
          >
            还需 {{ refs.getBoardRoles(state).length - playerCount }} 人
          </a-tag>
          <a-tag v-else color="success">✓ 人数一致</a-tag>
          <span class="judge-sworn" :class="{ pending: !state.judge }">
            {{ state.judge ? `⚖️ 法官：${state.judge}` : "⚖️ 双击下方成员卡选择法官" }}
          </span>
        </div>
      </template>
      <p class="small" style="margin: 6px 0">
        轻点 = 加入/移出；长按拖动 = 批量连选；双击 = 设为法官；滑动 = 滚动
      </p>

      <div
        class="member-pool"
        @touchmove="onPoolTouchMove"
        @pointerdown="onPoolPointerDown"
        @pointermove="onPoolPointerMove"
        @pointerup="onPoolPointerEnd"
        @pointerleave="onPoolPointerEnd"
        @pointercancel="onPoolPointerEnd"
      >
        <a-row :gutter="[12, 8]">
          <a-col v-for="n in poolMembers" :key="n" :span="8">
            <div
              class="member-item"
              :class="{ added: isAdded(n), judge: isJudge(n) }"
              :data-member-name="n"
            >
              <span class="member-check">{{ isAdded(n) ? "✓" : "" }}</span>
              <span class="member-name" :class="{ judge: isJudge(n) }">{{ n }}</span>
              <span v-if="isAdded(n)" class="member-no">{{ playerNo(n) }}</span>
              <span v-else-if="isJudge(n)" class="member-no judge-no">⚖</span>
            </div>
          </a-col>
        </a-row>
      </div>
      <div class="row" style="margin-top: 0">
        <span v-if="loadStatus" class="small">{{ loadStatus }}</span>
      </div>
      <SeatBoard
        v-if="state.players.length"
        :players="state.players"
        floating
        draggable
        :judge="state.judge"
        @reorder="(names: string[]) => actions.reorderPlayers(names)"
      />
      <a-empty v-if="!state.players.length" :image-simple="true" description="暂无玩家" />
      <div class="row" style="margin-top: 12px">
        <a-button type="primary" size="large" block @click="confirmPlayers">
          ✅ 确认参与玩家（{{ state.players.length }} 人）
        </a-button>
      </div>
    </a-card>

    <!-- 确认参与：最后核对法官 / 板子 / 模式，防止误操作 -->
    <a-modal v-model:open="confirmModal" title="确认参与玩家？" :footer="null" width="min(480px, 94vw)" :mask-closable="false" centered>
      <div class="confirm-grid">
        <div class="confirm-item">
          <span class="confirm-label">对局模式</span>
          <a-tag :class="state.simMode ? 'mode-tag sim' : 'mode-tag real'">{{ state.simMode ? "🧪 模拟对局" : "🎯 真实对局" }}</a-tag>
        </div>
        <div class="confirm-item">
          <span class="confirm-label">胜负模式</span>
          <b>{{ winModeText }}</b>
        </div>
        <div class="confirm-item">
          <span class="confirm-label">法官</span>
          <b>{{ state.judge }}</b>
        </div>
        <div class="confirm-item">
          <span class="confirm-label">板子</span>
          <b>{{ boardSummaryText }}</b>
        </div>
        <div class="confirm-item">
          <span class="confirm-label">参与玩家</span>
          <b>{{ state.players.length }} 人</b>
        </div>
      </div>
      <div class="row" style="margin-top: 16px">
        <a-button size="large" block @click="confirmModal = false">返回修改</a-button>
        <a-button type="primary" size="large" danger block @click="doConfirmPlayers">✅ 确认，进入对局</a-button>
      </div>
    </a-modal>

    <a-modal v-model:open="addRoleModal" title="＋ 加角色（选择剩余角色）" :footer="null" width="360px">
      <p class="small">已有角色用上方「+ / −」调整数量</p>
      <div v-if="remainingRoles.length" class="role-remaining">
        <div v-for="r in remainingRoles" :key="r" class="role-remaining-item" @click="addRole(r)">
          <img v-if="refs.roleAvatar(r)" class="role-avatar-img" :src="refs.roleAvatar(r)" :alt="r" />
          <span v-else>{{ refs.ROLE_EMOJI[r] || "🎭" }}</span>
          <span>{{ r }}</span>
          <a-tag color="success">添加</a-tag>
        </div>
      </div>
      <a-empty v-else description="已包含全部角色" :image-simple="true" />
    </a-modal>
  </div>
</template>

<style scoped>
/* ===== 选玩家卡片标题：人数与宣誓法官同行 ===== */
.pool-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.judge-sworn {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #f3c344;
  background: rgba(212,160,23,.12);
  border: 1px solid #f3c344;
  white-space: nowrap;
  position: absolute;
    right: 0;
    top: -10px;
}
.judge-sworn.pending {
  color: #8a8f9c;
  background: rgba(255,255,255,.04);
  border-color: rgba(255,255,255,.1);
  font-weight: 400;
}

/* ===== 区块分割线标题 ===== */
.section-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 8px;
  padding: 0 8px;
  color: #d4a017;
  font-size: 13px;
  font-weight: 600;
}
.section-divider::before,
.section-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
}
.section-divider::before {
  margin-right: 10px;
}
.section-divider::after {
  margin-left: 10px;
}

/* ===== 板子 / 胜负模式：紧凑单行选择 ===== */
.setup-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 4px;
}
.setup-section-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.setup-section .section-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #888;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.setup-section .section-divider {
  margin: 0;
  flex: 1 1 100%;
}
.board-fixed {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.board-hint {
  color: #666;
  font-size: 11px;
  white-space: nowrap;
}

/* ===== 胜负模式（紧凑按钮组）===== */
.win-mode-tabs {
  display: flex;
  gap: 8px;
}
.win-mode-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #1668dc10;
  border: 1.5px solid #dbdee96d;
  border-radius: 10px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.win-mode-tab:hover {
  border-color: #3a4466;
}
.win-mode-tab.active {
  position: relative;
  overflow: hidden;
  border-color: #1668dc;
  background: #171b28;
  box-shadow: 0 0 0 1px #1668dc33;
}
/* 选中态流光：斜向高光自左向右扫过，文字保持在流光之上 */
.win-mode-tab.active > * {
  position: relative;
}
.win-mode-tab.active::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  /* 宽度与标签一致：translateX 的百分比按自身宽度算，±50% 正好让光带从左缘扫到右缘。
     若把元素放大到 inset:-70%，行程会按放大后的宽度算，光带 10% 相位就扫出标签。 */
  width: 100%;
  background: linear-gradient(100deg, transparent 35%, rgba(150, 190, 255, 0.32) 50%, transparent 65%);
  transform: translateX(-50%);
  animation: winModeShimmer 2.8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes winModeShimmer {
  0% {
    transform: translateX(-50%);
  }
  55%,
  100% {
    transform: translateX(50%);
  }
}
/* 尊重系统「减少动态效果」：关掉常驻流光 */
@media (prefers-reduced-motion: reduce) {
  .win-mode-tab.active::after {
    animation: none;
    opacity: 0;
  }
}
.win-mode-icon {
  font-size: 18px;
  line-height: 1;
}
.win-mode-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.win-mode-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.win-mode-desc {
  color: #888;
  font-size: 10px;
}

/* ===== 角色编辑区 ===== */
.role-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  padding: 8px 12px;
  transition: all 0.2s;
}
.role-chip:hover {
  border-color: #3a4466;
}
.role-avatar-img {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: cover;
}
.role-avatar {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: #2a2e40;
}
.role-chip-name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}
.role-chip-count {
  color: green;
  font-size: 12px;
}
.role-btn {
  min-width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
}

/* ===== 成员池：固定3列 ===== */
.member-pool {
  max-height: 360px;
  overflow-y: auto;
  /* 号码角标溢出到卡片外 top/left -6px，池子留出安全边距并避免纵向滚动条盖住 */
  padding: 8px 10px 8px 8px;
}
.member-pool ::-webkit-scrollbar {
  width: 4px;
}
.member-pool ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.15);
  border-radius: 2px;
}
.member-pool ::-webkit-scrollbar-track {
  background: transparent;
}
.member-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content:center;
  gap: 8px;
  padding: 10px 12px;
  background: #171b28;
  border: 1px solid #2b3145;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
}
.member-item:hover {
  border-color: #3a4466;
  background: #1c2130;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
}
.member-item.added {
  border-color: #2e7d32;
  background: #1b2d1b;
}
.member-item.judge {
  border-color: #d4a017;
  background: #2b2410;
  opacity: 1;
  cursor: pointer;
}
.member-check {
  flex: none;
  width: 20px;
  height: 20px;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #2e7d32;
}
/* 名字不省略：号码已挪到卡片左上角绝对定位，不再挤占名字的宽度 */
.member-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #ddd;
  white-space: normal;
  overflow-wrap: anywhere;
}
.member-item.judge .member-name {
  color: #d4a017;
  font-weight: 600;
}
.member-item.added .member-name {
  color: #2e7d32;
  font-weight: 600;
}
/* 已选成员在卡片左上角标出座位号，和右侧座位牌的号码保持一致。
   绝对定位不占布局，名字因此能占满整行不被号码挤掉省略。 */
.member-no {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 21px;
  height: 21px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2e7d32;
  border: 1px solid #171b28;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
/* 法官：同一位置的 ⚖ 角标，金色系 */
.member-no.judge-no {
  background: #d4a017;
  color: #241c05;
  font-size: 12px;
}

/* ===== 提示文本 ===== */
.small {
  color: #888;
  font-size: 12px;
  text-align: center;
}

/* ===== 确认弹窗 ===== */
.confirm-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.confirm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.confirm-label {
  width: 72px;
  flex: none;
  color: #999;
  font-size: 13px;
}

/* 兼容旧类名（保留兼容性） */
.field-label {
  color: #888;
  font-size: 13px;
  white-space: nowrap;
}
.mode-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}
.row > .field-label {
  min-width: 48px;
}
/* 单个按钮撑满一整行（如「确认参与玩家」），多个按钮时用 flex 各自占一半 */
.row:has(> .ant-btn:only-child) {
  display: block;
}
.row:has(> .ant-btn:only-child) > .ant-btn {
  width: 100%;
}
.role-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #171b28;
  border: 1px solid #2b3145;
  border_radius: 10px;
  padding: 8px 12px;
  transition: all 0.2s;
}
.role-chip:hover {
  border-color: #3a4466;
}
.role-avatar-img {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: cover;
}
.role-avatar {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify_content: center;
  font-size: 14px;
  background: #2a2e40;
}
.role-chip-name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}
.role-chip-count {
  color: #33e333;
  font-size: 12px;
}
.role-btn {
  min-width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
}
.small {
  color: #888;
  font-size: 12px;
  text-align: center;
}
.mode-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
</style>
