import type { Reel } from '../lib/types'

// API 연결(#12) 전까지 플레이어를 단독으로 확인하기 위한 고정 데이터.
// 이미지는 public/sample/ 에 직접 만든 SVG (외부 출처 없음).
export const sampleReel: Reel = {
  title: '축제 첫날 🎉',
  scenes: [
    { mediaUrl: '/sample/1.svg', type: 'image', durationMs: 2500, caption: '드디어 시작된 우리 학교 축제', transition: 'fade' },
    { mediaUrl: '/sample/2.svg', type: 'image', durationMs: 2000, caption: '공강엔 잠깐 도서관 들렀다가', transition: 'slide' },
    { mediaUrl: '/sample/3.svg', type: 'image', durationMs: 2000, caption: '학식으로 에너지 충전 완료', transition: 'zoom' },
    { mediaUrl: '/sample/4.svg', type: 'image', durationMs: 3000, caption: '오늘 하루도 릴스로 남겨둘게', transition: 'fade' },
  ],
}
