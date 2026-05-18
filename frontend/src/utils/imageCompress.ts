import imageCompression from 'browser-image-compression'

const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024 // 1.5MB 以上才压缩
const MAX_SIZE_MB = 1.5
const MAX_WIDTH_OR_HEIGHT = 2400
const INITIAL_QUALITY = 0.85

/**
 * 上传前自动压缩。小文件 / 非图片 / gif 直接返回原文件。
 * 压缩失败时降级返回原文件，由后端 5MB 拦截兜底。
 */
export async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file
  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      initialQuality: INITIAL_QUALITY,
    })
  } catch (e) {
    console.warn('[imageCompress] 压缩失败，使用原文件', e)
    return file
  }
}
