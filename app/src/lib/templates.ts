import type { Template } from './types'

// docs/REELS_TEMPLATES.md §2 템플릿 4종 — 화면에 보여줄 이름
export const TEMPLATE_LABELS: Record<Template, string> = {
  emotional: '🎞️ 감성',
  montage: '📸 몽타주',
  review: '🍜 리뷰',
  closeup: '🔍 클로즈업',
}
