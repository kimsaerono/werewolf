<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import Sortable from "sortablejs"
import { ROLE_EMOJI, roleShort } from "@/game/logic"
import type { Player } from "@/game/logic"
import { getRoleInstance } from "@/game/roles/builtin"
import { roleAvatar } from "@/assets/roles"
import cupidThirdIcon from "@/assets/roles/第三阵营邱比特.png"
import sheriffIcon from "@/assets/roles/警长.png"

const props = withDefaults(
  defineProps<{
    players: Player[]
    showAlive?: boolean
    showRole?: boolean
    draggable?: boolean
    showLover?: boolean
    floating?: boolean
    lovers?: string[]
    thirdMembers?: string[]
    judge?: string
    jingHui?: string
  }>(),
  {
    showAlive: true,
    showRole: true,
    draggable: false,
    showLover: false,
    floating: false,
    lovers: () => [],
    thirdMembers: () => [],
    judge: "",
    jingHui: "",
  },
)
const emit = defineEmits<{ reorder: [names: string[]] }>()

/** 悬浮列优先填充所需行数：ceil(玩家数 / 2) */
const seatRows = computed(() => Math.max(1, Math.ceil(props.players.length / 2)))
/** 左右两列各自持有的玩家（DOM 顺序 = 左列上到下，再右列上到下） */
const leftPlayers = computed(() => props.players.slice(0, seatRows.value))
const rightPlayers = computed(() => props.players.slice(seatRows.value))

// ===== 半遮面：整列默认收进一半贴屏边，点一下 / 触摸滑出完整，静止 1.5s 自动收回 =====
// 注意：不做「再点一下收回」。展开后卡片要留给 Sortable 拖动，二次点击会先把卡片
// 收回半屏，pointer 被裁掉，拖动根本触发不了；收回统一交给「无操作静止 1.5s」。
const seatOpen = ref(false)
const SEAT_AUTO_HIDE_MS = 1500
let seatTimer: ReturnType<typeof setTimeout> | undefined

/** 点列上任意卡片：只展开（幂等），并开始静止倒计时 */
function openSeat() {
  seatOpen.value = true
  armSeatHide()
}
/** 任何指针活动（按下/抬起/移动/移入/移出）都重新计时；静止满 1.5s 自动收回 */
function armSeatHide() {
  if (seatTimer) clearTimeout(seatTimer)
  seatTimer = setTimeout(() => {
    seatOpen.value = false
    seatTimer = undefined
  }, SEAT_AUTO_HIDE_MS)
}
/** 拖拽 / 长按进行中：保持滑出且不启动倒计时 */
function holdSeatOpen() {
  if (seatTimer) clearTimeout(seatTimer)
  seatOpen.value = true
}
function clearSeatTimer() {
  if (seatTimer) clearTimeout(seatTimer)
  seatTimer = undefined
}

// ===== 拖动排序：左右两列各自一个 Sortable + 共享 group（跨列互换、元素随手） =====
const listEl = ref<HTMLElement | null>(null)
const leftEl = ref<HTMLElement | null>(null)
const rightEl = ref<HTMLElement | null>(null)
let sortables: Sortable[] = []

/** 读整板 DOM 最终顺序（左列先、右列后）→ 派生全局新顺序 */
function collectOrder(): string[] {
  const names: string[] = []
  listEl.value
    ?.querySelectorAll<HTMLElement>(".seat-card[data-name]")
    .forEach((card) => {
      const name = card.dataset.name
      if (name) names.push(name)
    })
  return names
}

function makeSortable(el: HTMLElement): Sortable {
  return new Sortable(el, {
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    delay: 200,
    delayOnTouchOnly: true,
    touchStartThreshold: 3,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    group: { name: "seats", pull: true, put: true },
    onChoose: (evt) => {
      // 触屏长按确认后：震动反馈 + 放大提示
      holdSeatOpen()
      const pt = (evt as unknown as { pointerType?: string }).pointerType
      if (pt === "touch" || pt === "pen") {
        vibrate(18)
      }
      if (evt.item) {
        evt.item.classList.add("dragging-lift")
      }
    },
    onEnd: (evt) => {
      if (evt.item) evt.item.classList.remove("dragging-lift")
      const names = collectOrder()
      if (names.length === props.players.length) emit("reorder", names)
      armSeatHide()
    },
  })
}

function destroySortables() {
  sortables.forEach((s) => s.destroy())
  sortables = []
}

function mountSortables() {
  destroySortables()
  if (!props.draggable) return
  if (props.floating) {
    if (leftEl.value) sortables.push(makeSortable(leftEl.value))
    if (rightEl.value) sortables.push(makeSortable(rightEl.value))
  } else if (listEl.value) {
    sortables.push(makeSortable(listEl.value))
  }
}

watch(
  () => props.draggable,
  () => mountSortables(),
  { immediate: true },
)

// draggable 为 true 时等待 DOM 就绪后再挂载 Sortable
onMounted(mountSortables)
onBeforeUnmount(() => {
  destroySortables()
  clearSeatTimer()
})

function badgeText(p: Player): string {
  const role = getRoleInstance(p.role)
  if (role && role.def.id === "丘比特") return "👑❤️"
  if (props.thirdMembers.includes(p.name)) return "❤️"
  return "💔"
}
function badgeClass(p: Player): string {
  return props.thirdMembers.includes(p.name) ? "third" : ""
}

/** 判断是否为丘比特角色 */
function isCupidRole(p: Player): boolean {
  const role = getRoleInstance(p.role)
  return !!(role && role.def.id === "丘比特")
}

/** 震动反馈：移动端支持 navigator.vibrate，桌面端忽略 */
function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(ms)
    } catch {
      /* ignore */
    }
  }
}

/** 角色 → 座位卡片背景色 */
const ROLE_BG: Record<string, string> = {
  白痴: "#fff",
  白狼王: "#F7F7F7",
  狼人: "rgb(125,4,13)",
  狼王: "#222228",
  猎人: "#B97846",
  女巫: "rgb(120,64,116)",
  平民: "#FFC860",
  骑士: "#B2DD98",
  守卫: "#94B8E0",
  预言家: "linear-gradient(135deg, #4088E8, #B868E0)",
  丘比特: "#F7B8D8",
}

/** 深色背景的文字需要改成浅色 */
const DARK_BG = new Set(["狼人", "狼王"])
const isDarkBg = (role?: string) => role ? DARK_BG.has(role) : false

function cardBg(p: Player): Record<string, string> | undefined {
  const style: Record<string, string> = {}
  if (p.role) {
    if (ROLE_BG[p.role]) {
      style.backgroundColor = ROLE_BG[p.role]
    }
    const img = roleAvatar(p.role)
    if (img) {
      style.backgroundImage = `url(${img})`
      style.backgroundSize = "cover"
      style.backgroundPosition = "center"
      style.backgroundRepeat = "no-repeat"
    } else if (p.avatar) {
      // 已分配角色但没有对应 PNG 时，回退显示默认 SVG 头像
      style.backgroundImage = `url(${p.avatar})`
      style.backgroundSize = "cover"
      style.backgroundPosition = "center"
      style.backgroundRepeat = "no-repeat"
    }
    if (DARK_BG.has(p.role)) {
      style.color = "#f0f0f0"
      style.borderColor = "rgba(255,255,255,0.15)"
    }
  } else if (p.avatar) {
    // 未分配角色时显示默认头像
    style.backgroundImage = `url(${p.avatar})`
    style.backgroundSize = "cover"
    style.backgroundPosition = "center"
    style.backgroundRepeat = "no-repeat"
  }
  if (!p.alive) {
    return undefined
  }
  return Object.keys(style).length ? style : undefined
}
</script>

<template>
  <div class="seat-board" :class="{ floating }">
    <div ref="listEl" class="seat-list">
      <template v-if="floating">
        <div
          ref="leftEl"
          class="seat-col seat-col-left"
          :class="{ 'is-open': seatOpen }"
          @pointerenter="armSeatHide"
        >
          <div
            v-for="(p, idx) in leftPlayers"
            :key="p.name"
            class="seat-card"
            :data-name="p.name"
            :class="{ dead: !p.alive, sheriff: p.name === jingHui }"
            :style="cardBg(p)"
            @pointerdown="openSeat"
            @pointermove="armSeatHide"
            @pointerup="armSeatHide"
            @pointercancel="armSeatHide"
          >
            <span v-if="draggable" class="seat-grip">⠿</span>
            <span class="seat-name-badge" :class="{ 'dark-bg': isDarkBg(p.role) }">
              <span class="seat-name-text"><span v-if="p.name === judge" style="color: #ffd666">⚖️</span>{{ p.name }}</span>
            </span>
            <span v-if="p.role && !roleAvatar(p.role)" class="seat-avatar float seat-avatar-emoji">{{ ROLE_EMOJI[p.role] || "🎭" }}</span>
            <span v-if="!p.alive" class="seat-dead-x">✕</span>
            <span class="seat-no float">{{ p.no || idx + 1 }}</span>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && isCupidRole(p))"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
            <span v-if="thirdMembers.includes(p.name) && isCupidRole(p)" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
            <span v-if="p.name === jingHui" class="seat-sheriff"><img :src="sheriffIcon" alt="警长" /></span>
            <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
          </div>
        </div>
        <div class="seat-col-spacer"></div>
        <div
          ref="rightEl"
          class="seat-col seat-col-right"
          :class="{ 'is-open': seatOpen }"
          @pointerenter="armSeatHide"
        >
          <div
            v-for="(p, idx) in rightPlayers"
            :key="p.name"
            class="seat-card"
            :data-name="p.name"
            :class="{ dead: !p.alive, sheriff: p.name === jingHui }"
            :style="cardBg(p)"
            @pointerdown="openSeat"
            @pointermove="armSeatHide"
            @pointerup="armSeatHide"
            @pointercancel="armSeatHide"
          >
            <span v-if="draggable" class="seat-grip">⠿</span>
            <span class="seat-name-badge" :class="{ 'dark-bg': isDarkBg(p.role) }">
              <span class="seat-name-text"><span v-if="p.name === judge" style="color: #ffd666">⚖️</span>{{ p.name }}</span>
            </span>
            <span v-if="p.role && !roleAvatar(p.role)" class="seat-avatar float seat-avatar-emoji">{{ ROLE_EMOJI[p.role] || "🎭" }}</span>
            <span v-if="!p.alive" class="seat-dead-x">✕</span>
            <span class="seat-no float">{{ p.no || seatRows + idx + 1 }}</span>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && isCupidRole(p))"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
            <span v-if="thirdMembers.includes(p.name) && isCupidRole(p)" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
            <span v-if="p.name === jingHui" class="seat-sheriff"><img :src="sheriffIcon" alt="警长" /></span>
            <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="(p, idx) in players"
          :key="p.name"
          class="seat-card"
          :data-name="p.name"
          :class="{ dead: !p.alive, sheriff: p.name === jingHui }"
          :style="cardBg(p)"
        >
          <span v-if="draggable" class="seat-grip">⠿</span>
          <span v-else-if="p.role && !roleAvatar(p.role)" class="seat-avatar seat-avatar-emoji">{{ ROLE_EMOJI[p.role] || "🎭" }}</span>
          <span v-if="!p.alive" class="seat-dead-x">✕</span>
          <div class="seat-info">
            <div class="seat-name">
              <span v-if="p.name === judge" style="color: #ffd666">⚖️</span>
              <img v-if="p.name === jingHui" :src="sheriffIcon" alt="警长" class="seat-sheriff-inline" />
              {{ p.name }}
            </div>
            <div class="seat-role" :title="p.role">
              <template v-if="showRole && p.role">{{ ROLE_EMOJI[p.role] || "" }}{{ roleShort(p.role) }}</template>
              <template v-else>—</template>
            </div>
          </div>
          <div class="seat-right">
            <span v-if="showAlive" class="seat-alive" :class="{ dead: !p.alive, sheriff: p.name === jingHui }">{{ p.alive ? "✅" : "❌" }}</span>
            <span class="seat-no">{{ p.no || idx + 1 }}</span>
          </div>
            <span
              v-if="showLover && (lovers.includes(p.name) || thirdMembers.includes(p.name)) && !(thirdMembers.includes(p.name) && isCupidRole(p))"
              class="seat-lover"
              :class="badgeClass(p)"
            >{{ badgeText(p) }}</span>
          <span v-if="thirdMembers.includes(p.name) && isCupidRole(p)" class="seat-cupid-third"><img :src="cupidThirdIcon" alt="第三阵营邱比特" /></span>
          <span v-if="p.mark?.idiotFlipped" class="seat-idiot">🙊</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.seat-board {
  width: 100%;
}
/* 禁止长按头像触发图片原生拖拽/复制/共享（移动端菜单） */
.seat-avatar {
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
/* 出局头像上的红叉 */
.seat-dead-x {
  position: absolute;
  inset: 0; /* 整卡覆盖 */
  z-index: 3;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff4d4f;
  font-size: 70px;
  font-weight: 900;
  line-height: 1;
  background: rgba(18, 22, 34, 0.55);
  border-radius: inherit;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 0.9);
}
.seat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 滚动条：默认隐藏（滑块透明），悬停/聚焦时显示细条，滚动功能不受影响 */
.seat-list {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.seat-list:hover,
.seat-list:focus-within {
  scrollbar-color: rgba(160, 190, 255, 0.45) transparent;
}
.seat-list::-webkit-scrollbar {
  width: 4px;
}
.seat-list::-webkit-scrollbar-track {
  background: transparent;
}
.seat-list::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}
.seat-list:hover::-webkit-scrollbar-thumb,
.seat-list:focus-within::-webkit-scrollbar-thumb {
  background: rgba(160, 190, 255, 0.45);
}

/* ===== 悬浮模式：固定贴边 + 左右两列（grid 三列：左窄列 / 中间留白 / 右窄列） ===== */
.seat-board.floating {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 90;
}
.seat-board.floating .seat-list {
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  box-sizing: border-box;
  /* 上下 10px padding 是面板 ::before 的出血空间，避免被 overflow 裁掉；横向 0 = 左右贴边 */
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  overscroll-behavior: contain; /* 内滚到边界不把回弹传给整页 */
  pointer-events: none; /* 容器不拦截点击，只在卡片上开放 */
  display: grid;
  grid-template-columns: var(--seat-col-w, 76px) 1fr var(--seat-col-w, 76px);
  align-items: start;
  gap: 8px;
  padding: 10px 0;
}
/* 半遮面：整列默认向屏幕边缘收进一半（只露出贴边的那半张卡片），
   点一下 / 触摸整列滑出到完整位置；面板始终只比卡片宽 --seat-ext 一条细边。 */
.seat-board.floating .seat-col {
  position: relative;
  width: var(--seat-col-w, 76px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.seat-board.floating .seat-col-left {
  transform: translateX(calc(-1 * var(--seat-retract, 50%)));
}
.seat-board.floating .seat-col-right {
  transform: translateX(var(--seat-retract, 50%));
}
.seat-board.floating .seat-col-left.is-open,
.seat-board.floating .seat-col-right.is-open {
  transform: translateX(0);
}
/* 左右列玻璃面板：贴边的一块彩色渐变 + 描边 + 顶部高光，和中间主内容区分开。
   pointer-events:none 保证不拦截卡片点击与 Sortable 拖动。 */
.seat-board.floating .seat-col::before {
  content: "";
  position: absolute;
  top: -10px;
  bottom: -10px;
  width: auto;
  border-radius: 22px;
  pointer-events: none;
  z-index: 0;
  border: 1px solid rgba(150, 180, 255, 0.28);
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(160, 190, 255, 0.3), rgba(160, 190, 255, 0) 70%),
    linear-gradient(180deg, rgba(122, 152, 240, 0.34) 0%, rgba(78, 96, 170, 0.2) 45%, rgba(10, 13, 24, 0.55) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 0 34px rgba(140, 170, 255, 0.18),
    0 12px 34px rgba(0, 0, 0, 0.45),
    0 0 22px rgba(110, 145, 255, 0.18);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}
/* 面板只比卡片宽 --seat-ext（内侧细边提示）；左侧列向右出血，右侧列向左出血 */
.seat-board.floating .seat-col-left::before {
  left: 0;
  right: calc(-1 * var(--seat-ext, 8px));
}
.seat-board.floating .seat-col-right::before {
  right: 0;
  left: calc(-1 * var(--seat-ext, 8px));
}
/* 内侧光墙：落在面板描边内侧，左右同色对称，跟随面板一起滑出 */
.seat-board.floating .seat-col::after {
  content: "";
  position: absolute;
  top: 8%;
  bottom: 8%;
  width: 3px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(190, 212, 255, 0), rgba(190, 212, 255, 0.7) 30%, rgba(190, 212, 255, 0.55) 70%, rgba(190, 212, 255, 0));
  box-shadow: 0 0 14px rgba(150, 185, 255, 0.75);
}
.seat-board.floating .seat-col-left::after {
  right: calc(-1 * var(--seat-ext, 8px));
}
.seat-board.floating .seat-col-right::after {
  left: calc(-1 * var(--seat-ext, 8px));
}
.seat-board.floating .seat-col > .seat-card {
  z-index: 1;
}
.seat-board.floating .seat-card {
  pointer-events: auto; /* 卡片区域可交互（拖动/滚动） */
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 4px;
  gap: 2px;
  border-radius: 10px;
  background: #ffffff;
  background-size: cover;
  background-position: center;
  border-color: #d5d9e4;
  cursor: grab;
  overflow: hidden;
  min-height: 60px;
  /* SVG 背景图抗锯齿优化 */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
.seat-board.floating .seat-card:active {
  cursor: grabbing;
}
.seat-board.floating .seat-card.dead {
  background: #161a26;
  border-color: #2b3145;
}

/* ===== 卡片通用（存活白底，可拖动） ===== */
.seat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #d5d9e4;
  background: #ffffff;
  color: #1d2233;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  /* SVG 背景图抗锯齿优化 */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
.seat-card.dead {
  opacity: 0.6;
  background: #161a26; /* 出局：原深色底 */
  border-color: #2b3145;
}
/* ===== 警长流光边框 ===== */
@property --sheriff-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.seat-card.sheriff {
  border-color: #ffd666;
  box-shadow: 0 0 10px rgba(255, 214, 102, 0.35);
  animation: sheriff-glow 1.6s ease-in-out infinite alternate;
}
.seat-board.floating .seat-card.sheriff {
  border-color: #ffd666;
}
/* 仅支持 mask 时才叠加流光环；不支持时退化为静态金边，避免整块渐变盖住卡片 */
@supports (mask-composite: exclude) or (-webkit-mask-composite: xor) {
  .seat-card.sheriff::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 3px;
    background: conic-gradient(
      from var(--sheriff-angle, 0deg),
      #fffef0 0%,
      #ffd666 12%,
      #8a5a00 26%,
      #241a04 40%,
      #8a5a00 54%,
      #ffd666 68%,
      #fffef0 82%,
      #ffd666 92%,
      #fffef0 100%
    );
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
    z-index: 1;
    animation: sheriff-flow 2s linear infinite;
  }
}
.seat-card.sheriff.dead::after {
  display: none;
}
.seat-card.sheriff.dead {
  border-color: #2b3145;
  box-shadow: none;
  /* 动画优先级高于静态声明，必须显式关掉呼吸辉光 */
  animation: none;
}
@keyframes sheriff-flow {
  to {
    --sheriff-angle: 360deg;
  }
}
@keyframes sheriff-glow {
  from {
    box-shadow: 0 0 5px rgba(255, 214, 102, 0.25);
  }
  to {
    box-shadow: 0 0 14px 2px rgba(255, 180, 40, 0.55);
  }
}
.seat-card.dead .seat-name {
  color: #aaa;
}
.seat-card.dead .seat-role {
  color: #888;
}
.sortable-ghost {
  opacity: 0.4;
  border-style: dashed;
  border-color: #2ed573;
  background: #2ed57314;
}
.sortable-chosen {
  background: #232a3d;
}
.sortable-drag {
  opacity: 0.95;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  border-color: #2ed573;
  z-index: 9999 !important;
}
/* 长按选中：体积稍稍放大 */
.dragging-lift {
  transform: scale(1.12);
  transition: transform 0.12s ease;
}
.seat-board.floating .seat-card.dragging-lift {
  transform: scale(1.15);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5);
}

/* ===== 悬浮专属尺寸 ===== */
.seat-board.floating .seat-grip {
  display: none;
}

/* 紧凑横向胶囊：左列靠右、右列靠左，收起态露出半边 */
.seat-name-badge {
  position: absolute;
  top: 0px;
  left:0;
  right: auto !important;
  padding: 1px;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  background: linear-gradient(135deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25));
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  z-index: 5;
  display: flex;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
}

/* 左列：靠右，收起时露出右半边 */
.seat-board.floating .seat-col-left .seat-name-badge {
  right: 0px !important;
  left: auto !important;
  transform: none !important;
}

/* 右列：靠左，收起时露出左半边 */
.seat-board.floating .seat-col-right .seat-name-badge {
  left: 0px !important;
  right: auto !important;
  transform: none !important;
}

.seat-name-badge .seat-name-text {
  font-size:11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.7);
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
  display: inline-block;
}

/* 深色背景角色（狼人/狼王） */
.seat-name-badge.dark-bg {
  background: linear-gradient(135deg, rgba(20,20,30,0.65), rgba(10,10,20,0.4));
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}

/* 法官/警长/丘比特图标在徽章内前缀 */
.seat-name-badge > span:first-child:not(.seat-name-text) {
  margin-right: 2px;
  font-size: 9px;
  vertical-align: middle;
}

/* 法官图标在徽章内特殊颜色 */
.seat-name-badge > span:first-child[style*="color"] {
  color: #ffd666 !important;
}

/* 死者状态：灰字保留描边 */
.seat-card.dead .seat-name-badge .seat-name-text {
  color: #aaa;
}
.seat-avatar.float {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  margin-top: 8px;
}
.seat-avatar-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: #2a2e40;
}
.seat-avatar-emoji.float {
  font-size: 18px;
}
.seat-no.float {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 24px;
  height: 24px;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2ed573;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.2);
  text-shadow: none;
  z-index: 2;
}
/* 右列：序号靠左，收起时可见 */
.seat-board.floating .seat-col-right .seat-no.float {
  left: 2px;
  right: auto;
}
/* 左列：序号保持右侧 */
.seat-board.floating .seat-col-left .seat-no.float {
  right: 2px;
  left: auto;
}
/* 死者：红底 */
.seat-card.dead .seat-no.float {
  background: #ff4d4f;
}
.seat-avatar {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  object-fit: cover;
}
.seat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.seat-name {
  font-weight: 600;
  font-size: 14px;
  color: #1d2233;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-role {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seat-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.seat-alive {
  font-size: 15px;
}
.seat-alive.dead {
  opacity: 0.6;
}
.seat-no {
  width: 22px;
  height: 22px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2ed573; /* 存活：绿底 */
  color: #fff;
  font-weight: 700;
  font-size: 12px;
}
.seat-card.dead .seat-no {
  background: #ff4d4f; /* 出局：红底 */
}
.seat-lover {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 11px;
  background: #ff5a8a;
  color: #fff;
  border-radius: 4px;
  padding: 1px 3px;
  line-height: 1.2;
}
.seat-lover.third {
  background: #9a6fe8;
}
.seat-sheriff {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 12px;
  background: linear-gradient(180deg, #ffd666 0%, #d49a00 100%);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.seat-sheriff img,
.seat-sheriff-inline {
  width: 14px;
  height: 14px;
  vertical-align: middle;
}
.seat-cupid-third {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 11px;
}
.seat-cupid-third img {
  width: 16px;
  height: 16px;
}
.seat-idiot {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 11px;
}
</style>