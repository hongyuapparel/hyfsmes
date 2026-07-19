const PRINT_IMAGE_TIMEOUT_MS = 15_000

function waitForOneImage(img: HTMLImageElement): Promise<void> {
  const src = (img.currentSrc || img.src || '').trim()
  if (!src || img.complete) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      img.removeEventListener('load', done)
      img.removeEventListener('error', done)
      resolve()
    }
    const timer = setTimeout(done, PRINT_IMAGE_TIMEOUT_MS)
    img.addEventListener('load', done)
    img.addEventListener('error', done)
  })
}

/** 等待容器内所有 img 加载完成（含失败/超时），避免打印预览出空白图 */
export async function waitForPrintImages(root: HTMLElement | null | undefined): Promise<void> {
  if (!root) return
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(imgs.map(waitForOneImage))
}

/** cloneNode 后把已加载原图的 src 同步到克隆体，尽量复用浏览器缓存 */
export function syncCloneImagesFromSource(source: HTMLElement, clone: HTMLElement): void {
  const sourceImgs = Array.from(source.querySelectorAll('img'))
  const cloneImgs = Array.from(clone.querySelectorAll('img'))
  cloneImgs.forEach((cloneImg, index) => {
    const sourceImg = sourceImgs[index]
    if (!sourceImg) return
    const url = (sourceImg.currentSrc || sourceImg.src || '').trim()
    if (url) cloneImg.src = url
  })
}
