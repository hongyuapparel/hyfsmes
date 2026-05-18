import request from './request'
import { resolveAssetUrl } from '@/utils/url'
import { maybeCompressImage } from '@/utils/imageCompress'

/** 上传图片，返回可访问的完整 URL */
export async function uploadImage(file: File): Promise<string> {
  const compressed = await maybeCompressImage(file)
  const formData = new FormData()
  formData.append('file', compressed)
  const res = await request.post<{ url: string }>('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}

/** 财务凭证/附件上传（收入/支出流水登记时使用） */
export async function uploadFinanceImage(file: File): Promise<string> {
  const compressed = await maybeCompressImage(file)
  const formData = new FormData()
  formData.append('file', compressed)
  const res = await request.post<{ url: string }>('/uploads/finance-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}

/** 面料出库拍照上传（使用 /inventory/fabric 权限） */
export async function uploadOutboundImage(file: File): Promise<string> {
  const compressed = await maybeCompressImage(file)
  const formData = new FormData()
  formData.append('file', compressed)
  const res = await request.post<{ url: string }>('/uploads/outbound-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}

export interface OrphanImageItem {
  filename: string
  sizeBytes: number
  mtime: string
  hasThumbnail: boolean
}

export interface ScanOrphanImagesResult {
  orphans: OrphanImageItem[]
  totalSize: number
  totalCount: number
  scanDurationMs: number
}

export interface DeleteOrphanImagesResult {
  deleted: string[]
  skipped: { filename: string; reason: string }[]
}

/** 扫描 uploads 目录中无数据库引用且超过 30 天的孤立图片（仅 admin） */
export async function scanOrphanImages(): Promise<ScanOrphanImagesResult> {
  const res = await request.post<ScanOrphanImagesResult>('/uploads/cleanup/scan')
  return res.data
}

/** 删除指定孤立图片（仅 admin） */
export async function deleteOrphanImages(filenames: string[]): Promise<DeleteOrphanImagesResult> {
  const res = await request.post<DeleteOrphanImagesResult>('/uploads/cleanup/delete', { filenames })
  return res.data
}
