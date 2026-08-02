import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportFinishedStock } from '@/api/inventory'
import type { StockTableLeafRow } from '@/utils/finishedStockTableUtils'

type FinishedStockExportOptions = {
  filter: {
    skuCode: string
    customerName: string
    inventoryTypeId: number | null
  }
  inboundDateRange: Ref<[string, string] | null>
  selectedRows: Ref<StockTableLeafRow[]>
  total: () => number
}

function buildTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

async function readBlobError(error: unknown): Promise<string> {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data
  if (responseData instanceof Blob) {
    try {
      const parsed = JSON.parse(await responseData.text()) as { message?: string | string[] }
      if (Array.isArray(parsed.message)) return parsed.message.join('；')
      if (parsed.message) return parsed.message
    } catch {
      // Ignore malformed blob responses and use the stable fallback below.
    }
  }
  const message = (error as { message?: unknown })?.message
  return typeof message === 'string' && message ? message : '导出失败'
}

export function useFinishedStockExport(options: FinishedStockExportOptions) {
  const exporting = ref(false)

  async function onExport() {
    if (exporting.value) return
    if (options.selectedRows.value.length === 0 && options.total() <= 0) {
      ElMessage.warning('当前没有可导出的库存数据')
      return
    }

    const selectedMode = options.selectedRows.value.length > 0
    const selections = selectedMode
      ? options.selectedRows.value.map((row) => ({
          id: Number(row.id),
          colorName: row._selectedColorName ?? '',
        }))
      : []
    const [startDate, endDate] = options.inboundDateRange.value ?? ['', '']
    exporting.value = true
    try {
      const res = await exportFinishedStock({
        skuCode: selectedMode ? undefined : options.filter.skuCode || undefined,
        customerName: selectedMode ? undefined : options.filter.customerName || undefined,
        inventoryTypeId: selectedMode ? undefined : options.filter.inventoryTypeId ?? undefined,
        startDate: selectedMode ? undefined : startDate || undefined,
        endDate: selectedMode ? undefined : endDate || undefined,
        selections,
      })
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `成品库存明细_${selectedMode ? '选中_' : ''}${buildTimestamp(new Date())}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)

      const failedImageCount = Number(res.headers['x-image-failures']) || 0
      const rowCount = Number(res.headers['x-export-row-count']) || 0
      if (failedImageCount > 0) {
        ElMessage.warning(`已导出 ${rowCount} 条明细，其中 ${failedImageCount} 张图片加载失败；请查看“图片加载失败”工作表`)
      } else {
        ElMessage.success(`已导出 ${rowCount} 条库存明细`)
      }
    } catch (error: unknown) {
      ElMessage.error(await readBlobError(error))
    } finally {
      exporting.value = false
    }
  }

  return { exporting, onExport }
}
