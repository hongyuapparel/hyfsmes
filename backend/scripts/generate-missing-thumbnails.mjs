#!/usr/bin/env node
/**
 * 扫描 uploads 下指定目录，为「原图」补全同目录 small_ 缩略图（与线上一致命名规则）。
 * 幂等：已存在 small_ 则跳过，不覆盖。
 *
 * 依赖：在后端目录已安装 sharp（npm install）
 *
 * 用法：
 *   cd /path/to/backend
 *   npm run thumbs:migration-old
 *   node scripts/generate-missing-thumbnails.mjs --root uploads/migration-old
 *   SKIP_THUMB_CONFIRM=1 node scripts/generate-missing-thumbnails.mjs   # 跳过确认（仅自动化场景）
 */

import { access, readdir, stat } from 'fs/promises'
import { createInterface } from 'readline'
import { basename, dirname, extname, join, resolve } from 'path'
import sharp from 'sharp'

const MAX_THUMB_WIDTH = 400
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function parseArgs(argv) {
  let root = join(process.cwd(), 'uploads', 'migration-old')
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      root = resolve(process.cwd(), argv[i + 1])
      i += 1
    }
  }
  return { root }
}

async function pathExists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function walkFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      await walkFiles(p, out)
    } else if (e.isFile()) {
      out.push(p)
    }
  }
  return out
}

async function generateBeside(originalAbsPath) {
  const base = basename(originalAbsPath)
  if (/^small_/i.test(base)) return { status: 'skip_small_prefix' }
  const ext = extname(base)
  if (!ALLOWED_EXT.has(ext.toLowerCase())) return { status: 'skip_ext' }

  const out = join(dirname(originalAbsPath), `small_${base}`)
  if (await pathExists(out)) return { status: 'exists' }

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
  return { status: 'created', out }
}

function promptBackup() {
  if (process.env.SKIP_THUMB_CONFIRM === '1') return Promise.resolve(true)
  return new Promise((resolvePromise) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    console.log('\n========================================')
    console.log('【重要】执行前请先完整备份目标目录（含 migration-old）')
    console.log('本脚本会新增 small_ 文件；已存在的 small_ 不会被覆盖。')
    console.log('========================================\n')
    rl.question('已备份并确认继续？(yes 回车) ', (line) => {
      rl.close()
      resolvePromise(String(line ?? '').trim().toLowerCase() === 'yes')
    })
  })
}

async function main() {
  const { root } = parseArgs(process.argv)
  const ok = await promptBackup()
  if (!ok) {
    console.log('已取消。')
    process.exit(0)
  }

  if (!(await pathExists(root))) {
    console.error('目录不存在:', root)
    process.exit(1)
  }

  const files = await walkFiles(root)
  let created = 0
  let skippedExists = 0
  let skippedOther = 0
  let failed = 0

  for (const abs of files) {
    const st = await stat(abs)
    if (!st.isFile()) continue
    try {
      const r = await generateBeside(abs)
      if (r.status === 'created') {
        created += 1
        if (created <= 20 || created % 200 === 0) console.log('生成:', r.out)
      } else if (r.status === 'exists') skippedExists += 1
      else skippedOther += 1
    } catch (e) {
      failed += 1
      console.warn('失败:', abs, e?.message ?? e)
    }
  }

  console.log('\n完成。')
  console.log('  新建缩略图:', created)
  console.log('  已有 small_ 跳过:', skippedExists)
  console.log('  其它跳过(扩展名/small_原图等):', skippedOther)
  console.log('  失败:', failed)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
