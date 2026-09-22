<script setup lang="ts">
import { computed, unref } from 'vue'
import type { Game } from '@/types'

interface Props {
  game: Game
  onFinishEarly: () => void
}

const props = defineProps<Props>()

const prediction = computed(() => {
  return unref(props.game.winPrediction) || {
    rates: { wolf: 50, good: 50, third: 0, draw: 0 },
    forcedWin: null,
    factors: [],
    hasThird: false
  }
})

const rates = computed(() => unref(prediction).rates)
const forcedWin = computed(() => unref(prediction).forcedWin)
const factors = computed(() => unref(prediction).factors)
const hasThird = computed(() => unref(prediction).hasThird)

const thirdLeft = computed(() => rates.value.wolf)
const drawLeft = computed(() => rates.value.wolf + rates.value.third)
</script>

<template>
  <div class="win-predictor">
    <!-- 头部：狼人在左，好人在右 -->
    <div class="wp-head">
      <span class="wp-side wolf-side"><i class="dot wolf"></i>狼人 <b>{{ rates.wolf }}%</b></span>
      <span class="wp-title">⚡ 胜率预测</span>
      <span class="wp-side good-side"><b>{{ rates.good }}%</b> 好人 <i class="dot good"></i></span>
    </div>

    <!-- 对战条：红狼从左往右，蓝好从右往左 -->
    <div class="wp-bars">
      <div class="wp-bar-track">
        <div class="wp-bar wolf" :style="{ width: `${rates.wolf}%` }"></div>
        <div v-if="hasThird" class="wp-bar third" :style="{ left: `${thirdLeft}%`, width: `${rates.third}%` }"></div>
        <div v-if="hasThird" class="wp-bar draw" :style="{ left: `${drawLeft}%`, width: `${rates.draw}%` }"></div>
        <div class="wp-bar good" :style="{ width: `${rates.good}%` }"></div>
      </div>
    </div>

    <!-- 第三方小行：仅在存在第三方阵营时显示 -->
    <div v-if="hasThird" class="wp-thirdline">
      <span><i class="dot third"></i>第三 <b>{{ rates.third }}%</b></span>
      <span><i class="dot draw"></i>平局 <b>{{ rates.draw }}%</b></span>
    </div>

    <div v-if="factors.length" class="wp-factors">
      <span class="factor-tag" v-for="f in factors" :key="f">{{ f }}</span>
    </div>

    <div v-if="forcedWin?.detected" class="wp-forced">
      <div class="wp-forced-text">
        <strong>⚡ 检测到必然结局：{{ forcedWin.reason }}</strong>
        <span>{{ forcedWin.detail }}</span>
      </div>
      <button class="wp-finish" @click="props.onFinishEarly()">✅ 提前结束对局</button>
    </div>
  </div>
</template>

<style scoped>
.win-predictor {
  border: 1px solid #5c6072;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(30,34,52,.9), rgba(18,21,34,.9));
  padding: 8px 12px;
  margin-bottom: 12px;
}

.wp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.wp-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffd166;
}

.wp-side {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #ccc;
}
.wp-side b { color: #fff; font-size: 14px; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot.wolf { background: #e74c3c; }
.dot.good { background: #3498db; }
.dot.third { background: #9b59b6; }
.dot.draw { background: #95a5a6; }

.wp-bars { margin-top: 6px; }

.wp-bar-track {
  position: relative;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255,255,255,.06);
}

.wp-bar { position: absolute; top: 0; height: 100%; transition: width .4s ease, left .4s ease; }
.wp-bar.wolf { left: 0; background: linear-gradient(90deg, #c0392b, #e74c3c); border-radius: 6px 0 0 6px; }
.wp-bar.good { right: 0; background: linear-gradient(90deg, #3498db, #2980b9); border-radius: 0 6px 6px 0; }
.wp-bar.third { background: #9b59b6; }
.wp-bar.draw { background: #95a5a6; }

.wp-thirdline {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 5px;
  font-size: 11px;
  color: #aaa;
}
.wp-thirdline span { display: inline-flex; align-items: center; gap: 4px; }
.wp-thirdline b { color: #fff; }

.wp-factors {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.factor-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,.08);
  color: #bbb;
  white-space: nowrap;
}

.wp-forced {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(255,107,107,.18), rgba(255,176,50,.18));
  border: 1px solid #ff6b6b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.wp-forced-text {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #eee;
  line-height: 1.5;
}
.wp-forced-text strong { color: #ff6b6b; font-size: 12px; }
.wp-forced-text span { color: #aaa; }

.wp-finish {
  padding: 6px 14px;
  background: linear-gradient(135deg, #ff6b6b, #ffa502);
  border: none;
  border-radius: 6px;
  color: #1a1a1a;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: transform .1s, box-shadow .2s;
}

.wp-finish:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(255,107,107,.4);
}

.wp-finish:active {
  transform: scale(.98);
}
</style>