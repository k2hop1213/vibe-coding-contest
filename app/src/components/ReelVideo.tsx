import { useState } from 'react'

type Props = {
  src: string
  /** 저장할 때 파일 이름 (확장자 제외) */
  fileName: string
}

/** 하나로 합쳐진 릴스 영상 재생 + 기기에 저장 (#27) */
export default function ReelVideo({ src, fileName }: Props) {
  const [saving, setSaving] = useState(false)
  const ext = src.split('?')[0].endsWith('.webm') ? 'webm' : 'mp4'

  // 서버가 다른 주소(Render)라 <a download>가 무시되므로 받아서 저장한다
  const save = async () => {
    setSaving(true)
    try {
      const blob = await (await fetch(src)).blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        src={src}
        className="aspect-[9/16] w-full rounded-2xl bg-black object-cover"
        controls
        autoPlay
        muted
        loop
        playsInline
        aria-label="릴스 영상"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-neutral-900 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? '저장하는 중…' : '⬇ 영상 저장'}
      </button>
    </div>
  )
}
