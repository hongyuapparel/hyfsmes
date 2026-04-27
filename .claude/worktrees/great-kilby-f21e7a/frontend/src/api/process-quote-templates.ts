import request from './request'

export interface ProcessQuoteTemplateItem {
  id: number
  templateId: number
  processId: number
  sortOrder: number
  department: string
  jobType: string
  processName: string
  unitPrice: string
}

export interface ProcessQuoteTemplate {
  id: number
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function getProcessQuoteTemplates() {
  return request.get<ProcessQuoteTemplate[]>('/process-quote-templates')
}

export function getProcessQuoteTemplate(id: number) {
  return request.get<ProcessQuoteTemplate>(`/process-quote-templates/${id}`)
}

/** 获取模板工序项（含工序详情），用于配置页与订单成本页导入 */
export function getProcessQuoteTemplateItems(id: number) {
  return request.get<ProcessQuoteTemplateItem[]>(`/process-quote-templates/${id}/items`)
}

export function createProcessQuoteTemplate(body: { name: string; sortOrder?: number }) {
  return request.post<ProcessQuoteTemplate>('/process-quote-templates', body)
}

export function updateProcessQuoteTemplate(
  id: number,
  body: { name?: string; sortOrder?: number },
) {
  return request.put<ProcessQuoteTemplate>(`/process-quote-templates/${id}`, body)
}

export function deleteProcessQuoteTemplate(id: number) {
  return request.delete<void>(`/process-quote-templates/${id}`)
}

export function setProcessQuoteTemplateItems(id: number, processIds: number[]) {
  return request.put<void>(`/process-quote-templates/${id}/items`, { processIds })
}
