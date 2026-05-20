import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import * as sharp from 'sharp'

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
    // PNG 原图多为产品/面料照片，无损 PNG 缩略图体积巨大（实测均约 300KB，列表加载慢）。
    // 改用 WebP 编码：体积小一个数量级且保留透明通道。文件名仍保持 small_xxx.png，
    // 由于服务器未设置 X-Content-Type-Options:nosniff，浏览器按内容嗅探即可正常渲染，前端无需改动。
    await pipeline.webp({ quality: 82 }).toFile(out)
  } else if (low === '.webp') {
    await pipeline.webp({ quality: 82 }).toFile(out)
  } else if (low === '.gif') {
    await pipeline.gif().toFile(out)
  } else {
    await pipeline.jpeg({ quality: 82 }).toFile(out)
  }
}
