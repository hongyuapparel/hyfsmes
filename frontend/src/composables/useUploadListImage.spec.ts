import { describe, expect, it } from 'vitest'
import { LIST_IMAGE_PLACEHOLDER } from '@/utils/image'
import { useUploadListImage } from '@/composables/useUploadListImage'

describe('useUploadListImage', () => {
  it('保存成功后可重置失败状态并重新加载缩略图', () => {
    const rawUrl = '/api/uploads/color-image-reset-test.jpeg'
    const { src, onError, reset } = useUploadListImage()

    expect(src(rawUrl)).toBe('/api/uploads/small_color-image-reset-test.jpeg')
    onError(rawUrl)
    expect(src(rawUrl)).toBe('/api/uploads/color-image-reset-test.jpeg')
    onError(rawUrl)
    expect(src(rawUrl)).toBe(LIST_IMAGE_PLACEHOLDER)

    reset(rawUrl)
    expect(src(rawUrl)).toBe('/api/uploads/small_color-image-reset-test.jpeg')
  })
})
