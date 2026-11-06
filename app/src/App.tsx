import { useEffect, useState } from 'react'
import { getHealth } from './lib/api'

type ServerState = 'checking' | 'ok' | 'down'

function App() {
  const [server, setServer] = useState<ServerState>('checking')

  useEffect(() => {
    getHealth()
      .then((h) => setServer(h.ok ? 'ok' : 'down'))
      .catch(() => setServer('down'))
  }, [])

  return (
    // 모바일 우선: 폰에서는 꽉 차게, PC에서는 가운데 폰 폭 카드
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white shadow-sm">
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-xl font-bold">하루릴스</h1>
        <span className="text-xs text-neutral-500" data-testid="server-status">
          {server === 'checking' && '서버 확인 중…'}
          {server === 'ok' && '서버 연결됨'}
          {server === 'down' && '서버 연결 안 됨'}
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 text-center text-neutral-500">
        <p>
          사진과 일기를 올리면
          <br />
          그날의 릴스가 만들어져요.
        </p>
      </main>
    </div>
  )
}

export default App
