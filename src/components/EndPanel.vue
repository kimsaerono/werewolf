<script setup lang="ts">
import { computed } from "vue"
import { App as AntApp } from "ant-design-vue"
import type { Game } from "@/types"

const { message } = AntApp.useApp()

const props = defineProps<{ game: Game }>()
const { state, actions, refs, judgeScore } = props.game

const winText = computed(() => (state.winCamp ? refs.WIN_TEXT[state.winCamp] : "未判定"))
const starOptions = ["-", "⭐入门", "⭐⭐熟练", "⭐⭐⭐精通"]

function doHonor() {
  actions.applyHonor(state.mvp, state.svp, state.beiguo)
  message.success("荣誉加分已应用")
}
function doFinish() {
  const err = actions.finishGameAuto()
  if (err) message.error(err)
  else message.success("结算完成，总分已固化")
}
</script>

<template>
  <div class="panel">
    <a-card title="🏁 对局结算" :bordered="false">
      <a-descriptions :column="1" size="small">
        <a-descriptions-item label="自动判定胜利阵营">
          <a-tag color="gold" style="font-size: 15px">{{ winText }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-if="state.judge" label="⚖️ 法官（+0.5/局）">
          {{ state.judge }} —— 累计 {{ judgeScore }} 分
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card title="🏆 荣誉选择（主观，手动选）" :bordered="false">
      <a-space :wrap="true">
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

    <a-card title="⭐ 角色星级认证" :bordered="false">
      <a-row :gutter="[12, 8]">
        <a-col v-for="p in state.players" :key="p.name" :xs="24" :sm="12" :lg="8">
          <a-space :wrap="true">
            <span style="min-width: 110px">{{ p.name }}({{ p.role }})：</span>
            <a-select style="min-width: 120px" v-model:value="p.star" :options="starOptions.map((s) => ({ value: s, label: s }))" />
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
      <a-button type="primary" danger size="large" @click="doFinish">
        ✅ 一键完整结算（自动胜负分+狼人存活分，固化总分）
      </a-button>
      <a-alert v-if="state.finished" type="success" show-icon message="本局已结算，总分已固化" style="margin-top: 12px" />
    </a-card>
  </div>
</template>
