import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useSizeGridInteraction } from './useSizeGridInteraction'

function setup() {
  const props = reactive({
    sizeMetaHeaders: ['部位'], sizeHeaders: ['S'], historyKey: '1',
    sizeInfoRows: [
      { __rowKey: 'a', metaValues: ['胸围'], sizeValues: ['50'] },
      { __rowKey: 'b', metaValues: ['衣长'], sizeValues: ['70'] },
    ], onSizeGridPaste: vi.fn(),
  })
  return { props, grid: useSizeGridInteraction(props) }
}
function copyEvent(selectedText = false) {
  const setData = vi.fn()
  const event = { target: { selectionStart: 0, selectionEnd: selectedText ? 1 : 0 },
    preventDefault: vi.fn(), clipboardData: { setData } } as unknown as ClipboardEvent
  return { event, setData }
}
describe('size grid user interactions', () => {
  it('copies only active cell, respects text selection and copies rectangular selection', () => {
    const { grid } = setup()
    const single = copyEvent(); grid.copy(single.event, 1, 1)
    expect(single.setData).toHaveBeenCalledWith('text/plain', '70')
    const text = copyEvent(true); grid.copy(text.event, 0, 0)
    expect(text.setData).not.toHaveBeenCalled()
    grid.pick(new MouseEvent('mousedown'), 0, 0)
    grid.pick(new MouseEvent('mousedown', { shiftKey: true }), 1, 1)
    const range = copyEvent(true); grid.copy(range.event, 0, 0)
    expect(range.setData).toHaveBeenCalledWith('text/plain', '胸围\t50\n衣长\t70')
  })
  it('clears a range as one undoable action, preserving other columns', async () => {
    const { grid, props } = setup()
    grid.pick(new MouseEvent('mousedown'), 0, 0)
    grid.extend(new MouseEvent('mouseenter', { buttons: 1 }), 1, 0)
    grid.keydown(new KeyboardEvent('keydown', { key: 'Delete' }))
    await nextTick()
    expect(props.sizeInfoRows.map(row => row.metaValues[0])).toEqual(['', ''])
    expect(props.sizeInfoRows.map(row => row.sizeValues[0])).toEqual(['50', '70'])
    grid.history.undo()
    expect(props.sizeInfoRows.map(row => row.metaValues[0])).toEqual(['胸围', '衣长'])
  })
  it('clears history when size columns change so undo cannot rebind old measurements', async () => {
    const { grid, props } = setup()
    await grid.action(() => { props.sizeInfoRows[0].sizeValues[0] = '55' })
    expect(grid.history.canUndo.value).toBe(true)
    props.sizeHeaders.push('M'); await nextTick()
    expect(grid.history.canUndo.value).toBe(false)
  })
})
