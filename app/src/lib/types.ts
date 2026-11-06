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
  /** 장면들을 하나로 합친 영상 (#27). 아직 안 합쳤으면 null/없음 */
  videoUrl?: string | null
}
