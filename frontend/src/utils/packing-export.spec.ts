import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { exportPackingListExcel } from './packing-export'
import type { PackingItemDetail, PackingListDetail } from '@/api/packing-lists'

vi.mock('xlsx', async (importOriginal) => ({ ...await importOriginal<typeof XLSX>(), writeFile: vi.fn() }))

function item(styleNo: string, sizeQuantities: Record<string, number>, totalQty: number): PackingItemDetail {
  return { id: 1, styleNo, styleName: '', colorName: '', imageUrl: '', sizeQuantities, totalQty, sourceType: 'manual', sourceId: null }
}

describe('packing Excel quantity consistency', () => {
  it('exports visible breakdown, line totals and footer consistently, including recovered hidden columns', () => {
    const raw: PackingListDetail = { id: 1, code: 'TEST', customerId: null, customerName: '', serviceManager: '', poNo: '', remark: '',
      country: '', postalCode: '', xiaomanOrderNo: '', xiaomanOrderId: '', packDate: null, showCompany: true,
      status: 'draft', shippedAt: null, operatorUsername: '', createdAt: '',
      sizeHeaders: ['70', '80', '100', '120'], boxes: [
        item('KR157', { 80: 44, 100: 42, 120: 42, S: 4 }, 999),
        item('KR157', { 80: 13, 100: 24, 120: 24 }, 61),
        item('KR158', { 70: 51, 80: 48 }, 104),
      ].map((item, index) => ({ id: index + 1, boxSeq: index + 1, items: [item], weightKg: null, cartonSize: '', remark: '' })),
    }
    exportPackingListExcel(raw)
    const calls = vi.mocked(XLSX.writeFile).mock.calls
    const workbook = calls[calls.length - 1][0]
    const roundtrip = XLSX.read(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(roundtrip.Sheets['装箱单'], { header: 1 })
    expect(rows[2].slice(3, 9)).toEqual(['70', '80', '100', '120', 'S', '合计 Qty'])
    expect(rows.slice(3, 6).map(r => r[8])).toEqual([132, 61, 99])
    expect(rows[6].slice(3, 9)).toEqual([51, 105, 66, 66, 4, 292])
    expect(raw.sizeHeaders).toEqual(['70', '80', '100', '120'])
  })
})
