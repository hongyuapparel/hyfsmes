import request from './request'
import { resolveAssetUrl } from '@/utils/url'

/** 上传图片，返回可访问的完整 URL */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<{ url: string }>('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}

/** 财务凭证/附件上传（收入/支出流水登记时使用） */
export async function uploadFinanceImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<{ url: string }>('/uploads/finance-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}

/** 面料出库拍照上传（使用 /inventory/fabric 权限） */
export async function uploadOutboundImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<{ url: string }>('/uploads/outbound-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return resolveAssetUrl(res.data?.url ?? '')
}
