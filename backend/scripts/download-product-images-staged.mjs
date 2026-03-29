#!/usr/bin/env node
/**
 * 从「当前数据库里 products.image_url」解析出可请求的地址，下载旧系统/已填写的图片，
 * 输出两套目录：
 *
 * 1) by-date/YYYY-MM-DD/   —— 按 URL 路径里出现的日期归档（便于你人工整理、核对）
 * 2) mirror-for-new-erp/ —— 扁平目录，文件名 = 数据库里 migration-old 等路径的最后一段，
 *    整目录可直接拷到服务器 backend/uploads/migration-old/（与静态路由 /api/uploads/... 一致）
 *
 * 依赖：backend/.env 中 MySQL 配置；本机可访问旧系统地址（默认 http，避免证书问题）。
 *
 * 用法（在 backend 目录下）：
 *   npm run download:product-images-staged
 *   npm run download:product-images-staged -- --dry-run
 *   npm run download:product-images-staged -- --insecure
 *   npm run download:product-images-staged -- --out ./staging/my-images --limit 100
 *
 * 环境变量：
 *   OLD_ASSET_BASE_URL  旧系统站点根，默认 http://47.112.218.75
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnv(envPath) {
  const env = {}
  if (!fs.existsSync(envPath)) return env
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue
    const idx = line.indexOf('=')
    env[line.slice(0, idx)] = line.slice(idx + 1).trim()
  }
  return env
}

function parseArgs(argv) {
  const args = { dryRun: false, insecure: false, limit: 0, out: '' }
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i]
    if (t === '--dry-run') args.dryRun = true
    else if (t === '--insecure') args.insecure = true
    else if (t === '--limit') {
      const n = Number(argv[i + 1] || 0)
      args.limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
      i += 1
    } else if (t === '--out') {
      args.out = argv[i + 1] || ''
      i += 1
    }
  }
  return args
}

function normalizeBase(base) {
  return String(base || '').replace(/\/$/, '')
}

/** 新系统磁盘上应对应的文件名（与 DB 里路径最后一段一致） */
function erpMirrorBasename(dbUrl) {
  const s = String(dbUrl || '').trim()
  if (!s) return ''
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s)
      return path.basename(u.pathname || '') || ''
    }
  } catch {
    /* fall through */
  }
  const noQuery = s.split('?')[0].split('#')[0]
  return path.basename(noQuery) || ''
}

/**
 * 依次尝试的下载 URL（先绝对地址，再拼 OLD_ASSET_BASE_URL）
 */
function buildCandidateUrls(dbUrl, oldBase) {
  const b = normalizeBase(oldBase)
  const u = String(dbUrl || '').trim()
  const out = []
  if (!u || !b) return out

  if (/^https?:\/\//i.test(u)) {
    out.push(u)
    return out
  }

  const p = u.startsWith('/') ? u : `/${u}`
  out.push(`${b}${p}`)

  // 部分环境旧站不带 /api 前缀
  if (p.startsWith('/api/')) {
    const stripped = p.replace(/^\/api/, '')
    if (stripped && stripped !== p) out.push(`${b}${stripped}`)
  }

  // DB 偶发写成 /uploads/migration-old/xxx（无 /api）
  if (p.startsWith('/uploads/') && !p.startsWith('/api/uploads/')) {
    out.push(`${b}/api${p}`)
  }

  return [...new Set(out)]
}

function extractDateFolder(pathname) {
  const m = String(pathname || '').match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : '_nodate'
}

function dateKeyFromCandidates(cands) {
  for (const c of cands) {
    try {
      const p = new URL(c).pathname
      const d = extractDateFolder(p)
      if (d !== '_nodate') return d
    } catch {
      /* continue */
    }
  }
  try {
    return extractDateFolder(new URL(cands[0]).pathname)
  } catch {
    return '_nodate'
  }
}

function downloadToFile(urlString, destPath, insecure) {
  return new Promise((resolve, reject) => {
    const tryOnce = (currentUrl) => {
      const cur = new URL(currentUrl)
      const lib2 = cur.protocol === 'https:' ? https : http
      const req = lib2.get(
        currentUrl,
        cur.protocol === 'https:' && insecure ? { rejectUnauthorized: false } : undefined,
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            const next = new URL(res.headers.location, currentUrl).toString()
            tryOnce(next)
            return
          }
          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          fs.mkdirSync(path.dirname(destPath), { recursive: true })
          const ws = fs.createWriteStream(destPath)
          res.pipe(ws)
          ws.on('finish', () => {
            ws.close(() => resolve({ finalUrl: currentUrl }))
          })
          ws.on('error', reject)
        },
      )
      req.on('error', reject)
      req.setTimeout(45000, () => req.destroy(new Error('timeout')))
    }

    tryOnce(urlString)
  })
}

async function tryDownloadFirst(candidates, destPath, insecure) {
  let lastErr
  for (const c of candidates) {
    try {
      const { finalUrl } = await downloadToFile(c, destPath, insecure)
      return { ok: true, usedUrl: c, finalUrl }
    } catch (e) {
      lastErr = e
    }
  }
  return { ok: false, error: lastErr }
}

function thumbCandidates(mainFinalUrl) {
  try {
    const u = new URL(mainFinalUrl)
    const dir = u.pathname.replace(/\/[^/]*$/, '/')
    const base = path.basename(u.pathname || '')
    if (!base) return []
    const encDir = u.origin + (dir.startsWith('/') ? dir : `/${dir}`)
    return [`${encDir}small_${base}`, `${encDir}small_${base.toLowerCase()}`]
  } catch {
    return []
  }
}

async function main() {
  const argvArgs = parseArgs(process.argv)
  const backendDir = path.resolve(__dirname, '..')
  const envPath = path.join(backendDir, '.env')
  const env = loadEnv(envPath)
  const oldBase =
    process.env.OLD_ASSET_BASE_URL || env.OLD_ASSET_BASE_URL || 'http://47.112.218.75'

  const outRoot = argvArgs.out
    ? path.resolve(process.cwd(), argvArgs.out)
    : path.join(backendDir, 'staging', 'product-images')

  const byDateRoot = path.join(outRoot, 'by-date')
  const mirrorRoot = path.join(outRoot, 'mirror-for-new-erp')

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  })

  const [rows] = await conn.query(
    "SELECT id, sku_code AS skuCode, image_url AS imageUrl FROM products WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''",
  )
  await conn.end()

  const list = Array.isArray(rows) ? rows : []
  const slice = argvArgs.limit > 0 ? list.slice(0, argvArgs.limit) : list

  const mirrorWritten = new Set()
  const report = {
    ok: true,
    oldBase,
    outRoot,
    totalRows: list.length,
    processedRows: slice.length,
    dryRun: argvArgs.dryRun,
    downloadedMain: 0,
    skippedMirrorExists: 0,
    downloadedThumb: 0,
    failedMain: 0,
    dryRunWouldTry: 0,
    failedRows: [],
  }

  if (!argvArgs.dryRun) {
    fs.mkdirSync(byDateRoot, { recursive: true })
    fs.mkdirSync(mirrorRoot, { recursive: true })
  }

  for (const row of slice) {
    const dbUrl = String(row.imageUrl || '').trim()
    const mirrorName = erpMirrorBasename(dbUrl)
    if (!mirrorName || !/\.(jpe?g|png|gif|webp)$/i.test(mirrorName)) {
      report.failedMain += 1
      report.failedRows.push({
        sku: row.skuCode,
        reason: 'invalid_or_missing_image_basename',
        imageUrl: dbUrl,
      })
      continue
    }

    const candidates = buildCandidateUrls(dbUrl, oldBase)
    if (!candidates.length) {
      report.failedMain += 1
      report.failedRows.push({ sku: row.skuCode, reason: 'no_candidate_url', imageUrl: dbUrl })
      continue
    }

    const dateKeyGuess = dateKeyFromCandidates(candidates)
    let archiveName = ''
    try {
      archiveName = path.basename(new URL(candidates[0]).pathname || '') || mirrorName
    } catch {
      archiveName = mirrorName
    }
    let safeArchive =
      archiveName === mirrorName ? archiveName : `${archiveName.replace(/[/\\]/g, '_')}`

    let archivePath = path.join(byDateRoot, dateKeyGuess, safeArchive)
    const mirrorPath = path.join(mirrorRoot, mirrorName)

    if (!argvArgs.dryRun && fs.existsSync(mirrorPath)) {
      report.skippedMirrorExists += 1
      continue
    }

    if (argvArgs.dryRun) {
      report.dryRunWouldTry += 1
      continue
    }

    if (fs.existsSync(archivePath)) {
      const ext = path.extname(safeArchive)
      const base = path.basename(safeArchive, ext)
      safeArchive = `${row.id}_${base}${ext}`
      archivePath = path.join(byDateRoot, dateKeyGuess, safeArchive)
    }

    const mainResult = await tryDownloadFirst(candidates, archivePath, argvArgs.insecure)
    if (!mainResult.ok) {
      report.failedMain += 1
      report.failedRows.push({
        sku: row.skuCode,
        reason: (mainResult.error && mainResult.error.message) || 'download_failed',
        imageUrl: dbUrl,
        tried: candidates.slice(0, 5),
      })
      continue
    }

    report.downloadedMain += 1

    if (!mirrorWritten.has(mirrorName.toLowerCase())) {
      fs.copyFileSync(archivePath, mirrorPath)
      mirrorWritten.add(mirrorName.toLowerCase())
    }

    const tcs = thumbCandidates(mainResult.finalUrl)
    const mirrorThumbPath = path.join(mirrorRoot, `small_${mirrorName}`)
    if (!fs.existsSync(mirrorThumbPath)) {
      for (const tu of tcs) {
        const tmpThumb = path.join(
          byDateRoot,
          dateKeyGuess,
          `small_${path.basename(new URL(tu).pathname || '')}`,
        )
        const tr = await tryDownloadFirst([tu], tmpThumb, argvArgs.insecure)
        if (tr.ok) {
          fs.copyFileSync(tmpThumb, mirrorThumbPath)
          report.downloadedThumb += 1
          break
        }
      }
    }
  }

  const manifestPath = path.join(outRoot, 'download-report.json')
  if (!argvArgs.dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify(report, null, 2), 'utf8')
  }

  console.log(JSON.stringify(report, null, 2))
  console.error('')
  console.error('下一步：把目录 mirror-for-new-erp 内全部文件上传到服务器')
  console.error(`  ${mirrorRoot}`)
  console.error('对应站点路径：backend/uploads/migration-old/')
  console.error('若缺少 small_ 缩略图，可在服务器 backend 目录执行：npm run thumbs:migration-old')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
