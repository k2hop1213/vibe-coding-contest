// docs/planning.md "API 계약 v2"의 GET /api/entries/{id} → reel(편집 플랜)과 1:1로 맞춘다.
// 렌더링 규칙은 docs/REELS_TEMPLATES.md
export type Template = 'emotional' | 'montage' | 'review' | 'closeup'
export type MediaType = 'image' | 'video'

export interface Clip {
  mediaUrl: string
  type: MediaType
  /** emotional·review: 컷마다 바뀌는 자막 */
  caption?: string | null
  /** emotional: 윗줄 영어 번역 */
  captionEn?: string | null
}

export interface FixedText {
  /** closeup은 3줄을 \n으로 구분 */
  title: string
  subtitle?: string | null
}

export interface Reel {
  template: Template
  /** 초. 템플릿 기본값 emotional 2.5 · montage/review 1.0 · closeup 0.8 */
  clipDuration: number
  bgmBpm?: number | null
  fixedText?: FixedText | null
  clips: Clip[]
  /** emotional: clips[startIndex] 앞에 사진을 0.15초 간격으로 빠르게 넘긴다 */
  flashMontage?: { startIndex: number; mediaUrls: string[] } | null
  /** 하나로 합친 영상 (#27). 아직 안 합쳤으면 null/없음 */
  videoUrl?: string | null
}

/** 옛 계약(v1, 장면 JSON) — 서버 #31 병합 전까지 들어온다. api.ts의 toPlan()이 v2로 바꾼다 */
export interface LegacyReel {
  title: string
  scenes: { mediaUrl: string; type: MediaType; durationMs: number; caption: string; transition?: string }[]
  videoUrl?: string | null
}
