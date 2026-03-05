import request from './request'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

/** 上传图片，返回可访问的完整 URL */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<{ url: string }>('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  const url = res.data?.url ?? ''
  return url.startsWith('http') ? url : `${baseURL.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}
