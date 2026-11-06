import type { Scene } from '../lib/types'

export interface PlayState {
  index: number // 현재 장면
  elapsed: number // 현재 장면에서 지난 시간(ms)
  loop: number // 처음으로 돌아간 횟수 (제목 오프닝·애니메이션을 다시 시작하는 데 사용)
}

export const MIN_SCENE_MS = 500

export function sceneDuration(scene: Scene): number {
  return Math.max(MIN_SCENE_MS, scene.durationMs || 0)
}

/** dt(ms)만큼 시간을 진행한다. 마지막 장면이 끝나면 처음으로 돌아간다(반복 재생). */
export function tick(state: PlayState, dt: number, scenes: Scene[]): PlayState {
  if (scenes.length === 0) return { index: 0, elapsed: 0, loop: state.loop }
  let { index, elapsed, loop } = state
  elapsed += Math.max(0, dt)
  while (elapsed >= sceneDuration(scenes[index])) {
    elapsed -= sceneDuration(scenes[index])
    index += 1
    if (index >= scenes.length) {
      index = 0
      loop += 1
    }
  }
  return { index, elapsed, loop }
}

/** 진행 바용: 장면 i가 얼마나 찼는지 0~1 */
export function segmentFill(i: number, state: PlayState, scenes: Scene[]): number {
  if (i < state.index) return 1
  if (i > state.index) return 0
  return Math.min(1, state.elapsed / sceneDuration(scenes[i]))
}
