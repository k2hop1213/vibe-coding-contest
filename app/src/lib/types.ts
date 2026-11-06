// docs/planning.md "API 계약"의 GET /api/entries/{id} → reel 모양과 1:1로 맞춘다.
export type Transition = 'fade' | 'slide' | 'zoom'

export interface Scene {
  mediaUrl: string
  type: 'image' | 'video'
  durationMs: number
  caption: string
  transition: Transition
}

export interface Reel {
  title: string
  scenes: Scene[]
}
