/**
 * 矩阵输入单元格的键盘方向导航：
 *   ← → ↑ ↓ Enter 在同一 el-table 内按 data-cell-r / data-cell-c 跳格。
 *
 * 使用：
 *   每个输入 cell 用一个带 `data-cell-r="行号" data-cell-c="列号"` 的容器包裹 el-input-number；
 *   el-input-number 上加 `@keydown="onMatrixCellKeydown"`。
 *   跨 table 不会跳（通过 input.closest('table') 限定作用域）。
 *
 * 左右键仅在光标到达输入框首/末位时才跳格，否则保留 input 内部的光标移动行为。
 */
export function onMatrixCellKeydown(e: KeyboardEvent): void {
  const input = e.target as HTMLInputElement | null
  if (!input || input.tagName !== 'INPUT') return
  const wrapper = (input.closest('[data-cell-r]') as HTMLElement | null)
  if (!wrapper) return
  const r = Number(wrapper.dataset.cellR ?? 0)
  const c = Number(wrapper.dataset.cellC ?? 0)
  const table = input.closest('table') as HTMLElement | null
  if (!table) return

  const at = (n: number) => input.selectionStart === n && input.selectionEnd === n
  const len = input.value?.length ?? 0

  let dr = 0
  let dc = 0
  if (e.key === 'ArrowLeft') {
    if (!at(0)) return
    dc = -1
  } else if (e.key === 'ArrowRight') {
    if (!at(len)) return
    dc = 1
  } else if (e.key === 'ArrowUp') {
    dr = -1
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    dr = 1
  } else {
    return
  }

  const target = table.querySelector<HTMLInputElement>(
    `[data-cell-r="${r + dr}"][data-cell-c="${c + dc}"] input`,
  )
  if (target) {
    e.preventDefault()
    target.focus()
    target.select?.()
  }
}

/**
 * 点击或 Tab 进入输入格时全选内容（默认 0 被高亮），直接打数字即可覆盖。
 * 用 setTimeout(0) 让浏览器自然 focus 完成后再 select，避免某些组件库内部把 selection 重置。
 */
export function selectAllOnFocus(e: Event): void {
  let target = e.target as HTMLElement | null
  if (target && target.tagName !== 'INPUT') {
    target = target.querySelector('input')
  }
  const input = target as HTMLInputElement | null
  if (!input || typeof input.select !== 'function') return
  setTimeout(() => {
    try { input.select() } catch { /* noop */ }
  }, 0)
}
