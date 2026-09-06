import { computed, nextTick, ref, watch } from 'vue'
import type { SizeInfoRow } from '@/composables/useOrderSizeInfo'
import { useSizeGridHistory } from '@/composables/useSizeGridHistory'
import { serializeSizeClipboard } from '@/utils/size-grid-clipboard'

interface GridProps {
  sizeInfoRows: SizeInfoRow[]
  sizeMetaHeaders: string[]
  sizeHeaders: string[]
  historyKey?: string
  onSizeGridPaste: (event: ClipboardEvent, row: number, col: number) => void
}
type Cell = { row: number; col: number }
export function useSizeGridInteraction(props: GridProps) {
  const anchor = ref<Cell>()
  const end = ref<Cell>()
  const selection = computed(() => {
    if (!anchor.value || !end.value) return undefined
    return { top: Math.min(anchor.value.row, end.value.row), bottom: Math.max(anchor.value.row, end.value.row),
      left: Math.min(anchor.value.col, end.value.col), right: Math.max(anchor.value.col, end.value.col) }
  })
  const multiple = computed(() => !!selection.value && (selection.value.top !== selection.value.bottom || selection.value.left !== selection.value.right))
  const selectionLabel = computed(() => {
    const s = selection.value
    return s ? `已选 ${s.bottom - s.top + 1} 行 × ${s.right - s.left + 1} 列` : '拖动或 Shift+点击选择区域；双击编辑文字'
  })
  const history = useSizeGridHistory(
    () => JSON.stringify({ headers: props.sizeMetaHeaders, rows: props.sizeInfoRows }),
    snapshot => {
      const data = JSON.parse(snapshot) as { headers: string[]; rows: SizeInfoRow[] }
      props.sizeMetaHeaders.splice(0, props.sizeMetaHeaders.length, ...data.headers)
      props.sizeInfoRows.splice(0, props.sizeInfoRows.length, ...data.rows)
      anchor.value = end.value = undefined
    },
  )
  watch(() => [props.historyKey, props.sizeInfoRows, JSON.stringify(props.sizeHeaders)], () => {
    history.reset(); anchor.value = end.value = undefined
  })
  function value(row: number, col: number) {
    const r = props.sizeInfoRows[row]
    return col < props.sizeMetaHeaders.length ? r.metaValues[col] ?? '' : r.sizeValues[col - props.sizeMetaHeaders.length] ?? ''
  }
  function selected(row: number, col: number) {
    const s = selection.value
    return !!s && row >= s.top && row <= s.bottom && col >= s.left && col <= s.right
  }
  function pick(event: MouseEvent, row: number, col: number) {
    history.commit()
    if (!event.shiftKey || !anchor.value) anchor.value = { row, col }
    end.value = { row, col }
    if (event.shiftKey) event.preventDefault()
  }
  function copy(event: ClipboardEvent, row: number, col: number) {
    const input = event.target as HTMLInputElement
    if (!multiple.value && input.selectionStart !== input.selectionEnd) return
    const s = multiple.value && selection.value ? selection.value : { top: row, bottom: row, left: col, right: col }
    const rows = Array.from({ length: s.bottom - s.top + 1 }, (_, i) =>
      Array.from({ length: s.right - s.left + 1 }, (_, j) => value(s.top + i, s.left + j)))
    event.preventDefault()
    event.clipboardData?.setData('text/plain', serializeSizeClipboard(rows))
  }
  function extend(event: MouseEvent, row: number, col: number) {
    if (event.buttons !== 1 || !anchor.value) return
    end.value = { row, col }
  }
  async function action(run: () => void) {
    history.commit(); history.begin(); run(); await nextTick(); history.commit()
  }
  function paste(event: ClipboardEvent, row: number, col: number) {
    const s = multiple.value ? selection.value : undefined
    void action(() => props.onSizeGridPaste(event, s?.top ?? row, s?.left ?? col))
  }
  function keydown(event: KeyboardEvent) {
    if (event.isComposing) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
      event.preventDefault(); event.stopPropagation()
      if (key === 'y' || event.shiftKey) history.redo(); else history.undo()
    } else if (event.key === 'Escape') {
      anchor.value = end.value = undefined
    } else if (multiple.value && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); event.stopPropagation()
      void action(() => {
        props.sizeInfoRows.forEach((r, row) => {
          r.metaValues.forEach((_, col) => { if (selected(row, col)) r.metaValues[col] = '' })
          r.sizeValues.forEach((_, col) => { if (selected(row, props.sizeMetaHeaders.length + col)) r.sizeValues[col] = '' })
        })
      })
    } else if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      anchor.value = end.value = undefined
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey &&
      (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
      history.begin()
    }
  }
  return { history, selectionLabel, selected, pick, extend, copy, paste, keydown, action }
}
