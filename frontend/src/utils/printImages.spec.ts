import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syncCloneImagesFromSource, waitForPrintImages } from './printImages'

describe('waitForPrintImages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('空容器直接返回', async () => {
    await expect(waitForPrintImages(null)).resolves.toBeUndefined()
    const root = document.createElement('div')
    await expect(waitForPrintImages(root)).resolves.toBeUndefined()
  })

  it('已 complete 的图片不等待', async () => {
    const root = document.createElement('div')
    const img = document.createElement('img')
    Object.defineProperty(img, 'complete', { value: true })
    img.src = 'https://example.com/a.jpg'
    root.appendChild(img)

    await expect(waitForPrintImages(root)).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('加载中的图片在 load 后 resolve', async () => {
    const root = document.createElement('div')
    const img = document.createElement('img')
    Object.defineProperty(img, 'complete', { value: false })
    img.src = 'https://example.com/b.jpg'
    root.appendChild(img)

    const pending = waitForPrintImages(root)
    img.dispatchEvent(new Event('load'))
    await expect(pending).resolves.toBeUndefined()
  })

  it('加载失败（complete 且无尺寸）不阻塞到超时', async () => {
    const root = document.createElement('div')
    const img = document.createElement('img')
    Object.defineProperty(img, 'complete', { value: true })
    Object.defineProperty(img, 'naturalWidth', { value: 0 })
    img.src = 'https://example.com/broken.jpg'
    root.appendChild(img)

    await expect(waitForPrintImages(root)).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('syncCloneImagesFromSource', () => {
  it('按顺序把源图 src 同步到克隆图', () => {
    const source = document.createElement('div')
    const clone = document.createElement('div')
    const sourceImg1 = document.createElement('img')
    const sourceImg2 = document.createElement('img')
    sourceImg1.src = 'https://example.com/1.jpg'
    sourceImg2.src = 'https://example.com/2.jpg'
    source.append(sourceImg1, sourceImg2)

    const cloneImg1 = document.createElement('img')
    const cloneImg2 = document.createElement('img')
    clone.append(cloneImg1, cloneImg2)

    syncCloneImagesFromSource(source, clone)

    expect(cloneImg1.src).toBe('https://example.com/1.jpg')
    expect(cloneImg2.src).toBe('https://example.com/2.jpg')
  })
})
