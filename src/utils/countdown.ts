// 全局唯一倒计时器：任何时刻最多一个 interval，避免多个计时器重叠
type Handler = (left: number) => void

let timer: ReturnType<typeof setInterval> | null = null
let left = 0
let running = false
let onTick: Handler | null = null
let onEnd: (() => void) | null = null

export function startCountdown(seconds: number, tick: Handler, end: () => void): void {
  stopCountdown()
  left = Math.max(1, Math.floor(seconds))
  running = true
  onTick = tick
  onEnd = end
  tick(left)
  timer = setInterval(() => {
    left -= 1
    if (left <= 0) {
      running = false
      const endCb = onEnd
      const tickCb = onTick
      stopCountdown()
      tickCb?.(0)
      endCb?.()
      return
    }
    onTick?.(left)
  }, 1000)
}

export function stopCountdown(): void {
  if (timer) clearInterval(timer)
  timer = null
  running = false
  onTick = null
  onEnd = null
}

export function isCounting(): boolean {
  return running
}

export function countdownLeft(): number {
  return left
}
