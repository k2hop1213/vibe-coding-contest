// 배포 시에는 VITE_API_BASE(예: https://xxx.onrender.com)를, 개발 중에는 vite proxy를 쓴다.
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function getHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error(`health ${res.status}`)
  return res.json()
}
