// 서버 허용 목록과 같게 (planning.md: jpg·jpeg·png·gif·webp·mp4·mov·webm, SVG·HEIC 불가)
export const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm'
const ALLOWED = /\.(jpe?g|png|gif|webp|mp4|mov|webm)$/i
export const isAllowed = (f: File) => /^(image|video)\//.test(f.type) && ALLOWED.test(f.name)
