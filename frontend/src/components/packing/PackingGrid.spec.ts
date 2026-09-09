import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PackingGrid from './PackingGrid.vue'
import { usePackingGridRows } from '@/composables/usePackingGridRows'

vi.mock('@/components/ImageUploadArea.vue', () => ({ default: { template: '<span />' } }))
vi.mock('@/components/AppImageThumb.vue', () => ({ default: { template: '<span />' } }))

let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

async function setupGrid(headers = ['S', 'M']) {
  const grid = usePackingGridRows()
  grid.sizeHeaders.value = headers
  grid.addBox()
  Object.assign(grid.boxes.value[0].items[0], { styleNo: 'KR157', sizeQuantities: { S: 5 }, totalQty: 5 })
  wrapper = mount(defineComponent({
    setup: () => () => h(PackingGrid, {
      flatRows: grid.flatRows.value,
      sizeHeaders: grid.sizeHeaders.value,
      totals: grid.totals.value,
      onRenameSize: grid.commitSizeHeader,
      onRemoveSizeAt: grid.removeSizeColumnAt,
    }),
  }), { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await nextTick()
  await nextTick()
  return { grid, view: wrapper }
}

describe('PackingGrid real Element Plus inputs', () => {
  it('duplicate and empty header edits revert the input without losing quantities', async () => {
    const { grid, view } = await setupGrid()
    const input = view.find('.size-header-input input')
    await input.setValue('M')
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('S')
    await input.setValue('')
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('S')
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ S: 5 })
  })

  it('manual total-only rows survive empty size inputs and column operations', async () => {
    const { grid } = await setupGrid()
    const item = grid.boxes.value[0].items[0]
    item.sizeQuantities = {}
    item.totalQty = 7
    await nextTick()
    grid.addSizeColumn()
    await nextTick()
    grid.removeSizeHeader('S')
    expect(grid.totals.value.totalQty).toBe(7)
  })

  it('typing a header does not detach quantities before commit; consecutive renames migrate once', async () => {
    const { grid, view } = await setupGrid()
    const input = view.find('.size-header-input input')
    await input.trigger('focus')
    ;(input.element as HTMLInputElement).value = '80'
    await input.trigger('input')
    expect(grid.sizeHeaders.value).toEqual(['S', 'M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ S: 5 })
    expect(grid.totals.value.totalQty).toBe(5)
    await input.trigger('change')
    expect(grid.sizeHeaders.value).toEqual(['80', 'M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ '80': 5 })
    await input.setValue('100')
    expect(grid.sizeHeaders.value).toEqual(['100', 'M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ '100': 5 })
  })

  it('deleting the last populated column cannot revive a previously saved total', async () => {
    const { grid, view } = await setupGrid()
    await view.get('button[aria-label="删除第1列"]').trigger('click')
    expect(grid.totals.value.totalQty).toBe(0)
    expect(grid.boxes.value[0].items[0].totalQty).toBe(0)
    expect((view.get('input[placeholder="件数"]').element as HTMLInputElement).value).toBe('0')
  })

  it('entering 5, zero and blank updates row and footer with no old-total fallback', async () => {
    const { grid, view } = await setupGrid()
    const input = view.find('.el-table__body .qty-input input')
    await input.setValue('5')
    await input.trigger('blur')
    expect(grid.totals.value.totalQty).toBe(5)
    await input.setValue('0')
    await input.trigger('blur')
    expect(grid.totals.value.totalQty).toBe(0)
    await input.setValue('5')
    await input.trigger('blur')
    await input.setValue('')
    await input.trigger('blur')
    expect(grid.totals.value.totalQty).toBe(0)
    expect(view.find('.el-table__footer-wrapper').text()).not.toContain('5')
  })
})
