import { resolveAssetUrl } from './url'

const SPECIAL_URL_RE = /^(?:data|blob):/i
const ABSOLUTE_HTTP_RE = /^https?:\/\//i
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i

/** 与上传目录 sibling 的 small_ 缩略图规则适用的路径（站内相对路径） */
const SIBLING_THUMB_PATH_RE = /^\/(?:uploads\/|migration-old\/)/i

export type ListImagePhase = 'thumb' | 'full' | 'placeholder'

/** 列表/缩略位失败时的占位图（避免继续触发无效请求） */
export const LIST_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
      '<rect fill="#eee" width="100%" height="100%"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#bbb" font-size="11">无图</text>' +
      '</svg>',
  )

/**
 * 用于列表状态去重：同一展示 URL 应用同一套回退阶段，避免重复请求与闪烁。
 */
export function listImageStateKey(raw: string | undefined): string {
  return resolveAssetUrl(String(raw ?? '').trim())
}

function pathOnly(url: string): string {
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  let end = url.length
  if (q >= 0) end = Math.min(end, q)
  if (h >= 0) end = Math.min(end, h)
  return url.slice(0, end)
}

function suffixFromUrl(url: string, path: string): string {
  return url.length > path.length ? url.slice(path.length) : ''
}

/**
 * 解析「优先 small_、失败再原图」的两级 URL。
 * - 仅对站内 `/uploads/`、`/migration-old/` 下的常见图片后缀启用 sibling 规则；
 * - 外链、data:、无扩展名路径等保持 thumb === full，仅一次加载，失败直接进占位。
 */
export function getUploadListImageVariants(resolved: string): { thumb: string; full: string } {
  const trimmed = String(resolved ?? '').trim()
  if (!trimmed) return { thumb: '', full: '' }
  if (SPECIAL_URL_RE.test(trimmed)) return { thumb: trimmed, full: trimmed }
  if (ABSOLUTE_HTTP_RE.test(trimmed)) return { thumb: trimmed, full: trimmed }

  const p = pathOnly(trimmed)
  const normalized = p.startsWith('/') ? p : `/${p}`
  if (!IMAGE_EXT_RE.test(normalized)) return { thumb: trimmed, full: trimmed }
  if (!SIBLING_THUMB_PATH_RE.test(normalized)) return { thumb: trimmed, full: trimmed }

  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return { thumb: trimmed, full: trimmed }
  const dir = normalized.slice(0, idx + 1)
  const name = normalized.slice(idx + 1)
  if (!name) return { thumb: trimmed, full: trimmed }

  const tail = suffixFromUrl(trimmed, p)
  const rebuild = (path: string) => `${path}${tail}`

  if (/^small_/i.test(name)) {
    const fullName = name.replace(/^small_/i, '')
    return {
      thumb: rebuild(normalized),
      full: rebuild(`${dir}${fullName}`),
    }
  }
  return {
    thumb: rebuild(`${dir}small_${name}`),
    full: rebuild(normalized),
  }
}

export function getListImageDisplaySrc(
  raw: string | undefined,
  phases: Record<string, ListImagePhase>,
): string {
  const key = listImageStateKey(raw)
  if (!key) return LIST_IMAGE_PLACEHOLDER

  const { thumb, full } = getUploadListImageVariants(key)
  const cur = phases[key] ?? 'thumb'

  if (cur === 'placeholder') return LIST_IMAGE_PLACEHOLDER

  if (thumb === full) {
    return cur === 'thumb' ? thumb : LIST_IMAGE_PLACEHOLDER
  }
  if (cur === 'thumb') return thumb
  return full
}

/**
 * el-image @error 时调用一次；已占位或已处于最终阶段时不做任何事，避免死循环与重复回退。
 */
export function advanceListImagePhaseOnError(
  raw: string | undefined,
  phases: Record<string, ListImagePhase>,
): void {
  const key = listImageStateKey(raw)
  if (!key) return

  const cur = phases[key] ?? 'thumb'
  if (cur === 'placeholder') return

  const { thumb, full } = getUploadListImageVariants(key)

  if (thumb === full) {
    if (cur === 'thumb') phases[key] = 'placeholder'
    return
  }
  if (cur === 'thumb') phases[key] = 'full'
  else if (cur === 'full') phases[key] = 'placeholder'
}

/** 预览大图用原图 URL（若存的是 small_ 则去掉前缀对应的完整地址） */
export function getUploadImageOriginalForPreview(raw: string | undefined): string {
  const key = listImageStateKey(raw)
  if (!key) return ''
  const { full } = getUploadListImageVariants(key)
  return full || key
}

/** 首屏优先请求的地址（有 sibling 规则时先试 small_） */
export function toPreferredThumbUrl(rawUrl: string | undefined): string {
  const key = listImageStateKey(rawUrl)
  if (!key) return ''
  const { thumb, full } = getUploadListImageVariants(key)
  return thumb === full ? key : thumb
}

/**
 * @deprecated 使用 {@link toPreferredThumbUrl}；行为已扩展为全站 `/uploads/` + `/migration-old/` 的 small_ 规则。
 */
export function toMigrationThumbUrl(rawUrl: string | undefined): string {
  return toPreferredThumbUrl(rawUrl)
}
