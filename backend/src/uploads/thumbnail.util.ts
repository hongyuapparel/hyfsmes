import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import sharp from 'sharp'

const MAX_THUMB_WIDTH = 400

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

/**
 * 在与原图同目录生成 `small_${basename}`；已存在、或原名为 small_ 开头、或非允许后缀时跳过。
 */
export async function generateSmallThumbnailBeside(originalAbsPath: string): Promise<void> {
  const base = basename(originalAbsPath)
  if (/^small_/i.test(base)) return
  const ext = extname(base)
  if (!ALLOWED_EXT.has(ext.toLowerCase())) return

  const dir = dirname(originalAbsPath)
  const out = join(dir, `small_${base}`)
  if (existsSync(out)) return

  const pipeline = sharp(originalAbsPath)
    .rotate()
    .resize(MAX_THUMB_WIDTH, null, { withoutEnlargement: true })

  const low = ext.toLowerCase()
  if (low === '.png') {
    await pipeline.png({ compressionLevel: 9 }).toFile(out)
  } else if (low === '.webp') {
    await pipeline.webp({ quality: 82 }).toFile(out)
  } else if (low === '.gif') {
    await pipeline.gif().toFile(out)
  } else {
    await pipeline.jpeg({ quality: 82 }).toFile(out)
  }
}
