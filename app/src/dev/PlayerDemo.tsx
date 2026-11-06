import ReelPlayer from '../components/ReelPlayer'
import { sampleReel } from './sampleReel'

/** 개발용 미리보기: http://localhost:5173/?demo=player */
export default function PlayerDemo() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 bg-white p-4">
      <h1 className="text-lg font-bold">릴스 플레이어 미리보기</h1>
      <ReelPlayer reel={sampleReel} />
      <p className="text-center text-xs text-neutral-500">탭하면 일시정지 / 재생</p>
    </div>
  )
}
