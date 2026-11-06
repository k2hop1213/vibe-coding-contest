import type { Reel } from '../lib/types'

// 플레이어를 단독으로 확인하기 위한 고정 편집 플랜 (http://localhost:5173/?demo=player).
// 이미지는 public/sample/ 에 직접 만든 SVG (외부 출처 없음).
const img = (n: number) => `/sample/${n}.svg`

export const sampleReel: Reel = {
  template: 'emotional',
  clipDuration: 2.5,
  bgmBpm: 120,
  fixedText: null,
  clips: [
    { mediaUrl: img(1), type: 'image', caption: '드디어 시작된 축제', captionEn: 'The festival finally begins' },
    { mediaUrl: img(2), type: 'image', caption: '공강엔 잠깐 도서관', captionEn: 'A quick stop at the library' },
    { mediaUrl: img(3), type: 'image', caption: '학식으로 충전 완료', captionEn: 'Recharged at the cafeteria' },
    { mediaUrl: img(4), type: 'image', caption: '오늘도 릴스로 남겨둘게', captionEn: "I'll keep today as a reel" },
  ],
  flashMontage: { startIndex: 2, mediaUrls: [1, 2, 3, 4, 1, 2, 3, 4].map(img) },
}
