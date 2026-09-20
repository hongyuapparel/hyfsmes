import { computed, ref, watch, type Ref } from 'vue'
import { exportOutboundRecords, type OutboundExportFilters, type OutboundExportKind, type OutboundExportPayload } from '@/api/inventory-outbound-export'
import { useInventoryWorkbookExport } from './useInventoryWorkbookExport'

type ExportRow = { id: number; exportKey?: string }
export const outboundExportRowKey = (row: ExportRow) => row.exportKey ?? String(row.id)

export function useOutboundRecordExport<Row extends ExportRow>(options: {
  kind: OutboundExportKind
  filename: string
  filters: () => OutboundExportFilters
  loading: () => boolean
  total: () => number
  table: Ref<unknown>
  selectedRows?: Ref<Row[]>
}) {
  const selectedRows = options.selectedRows ?? ref<ExportRow[]>([])
  const filterKey = computed(() => JSON.stringify(options.filters()))
  function clearSelection() {
    selectedRows.value = []
    const table = options.table.value
    if (table && typeof table === 'object' && 'clearSelection' in table && typeof table.clearSelection === 'function') table.clearSelection()
  }
  watch(options.loading, loading => {
    if (loading) clearSelection()
  }, { flush: 'sync', immediate: true })
  watch(filterKey, clearSelection, { flush: 'sync' })
  const disabled = computed(() => options.loading() || options.total() <= 0)
  const exporter = useInventoryWorkbookExport<ExportRow, OutboundExportPayload>({
    selectedRows, total: options.total, getRowId: row => row.id,
    buildPayload: (_ids, selected) => selected
      ? { mode: 'selected', selectedKeys: selectedRows.value.map(outboundExportRowKey) }
      : { mode: 'filtered', ...options.filters() },
    request: payload => exportOutboundRecords(options.kind, payload), filenamePrefix: options.filename, dataLabel: '出库记录',
  })
  return {
    selectedRows, clearSelection, disabled, exporting: exporter.exporting,
    buttonText: computed(() => selectedRows.value.length ? `导出选中（${selectedRows.value.length}）` : '导出筛选结果'),
    onSelectionChange: (rows: Row[]) => { if (!options.loading()) selectedRows.value = rows },
    onExport: () => { if (!disabled.value) return exporter.onExport() },
  }
}
