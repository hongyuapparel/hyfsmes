type Dir = 'up' | 'down' | 'left' | 'right'

/**
 * 表格内可编辑单元格的方向键/回车导航（类 Excel）。
 * - ↑/↓/回车：始终跨格（回车=下一行同列），数字框不再被用于步进
 * - ←/→：文本框光标在首/尾时才跨格，否则正常移动光标
 * 用"空间最近邻"选目标，天然兼容 rowspan 合并、跳过的单元格、混合列类型。
 * getContainer 返回包裹 el-table 的元素；只在 .el-table__body 内、排除下拉(el-select)。
 */
export function useGridKeyboardNav(getContainer: () => HTMLElement | null) {
  function inputs(): HTMLInputElement[] {
    const root = getContainer()
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLInputElement>('.el-table__body input:not([disabled])')).filter(
      (el) => !el.closest('.el-select') && el.offsetParent !== null,
    )
  }

  function nearest(current: HTMLInputElement, dir: Dir): HTMLInputElement | null {
    const cur = current.getBoundingClientRect()
    const cx = cur.left + cur.width / 2
    const cy = cur.top + cur.height / 2
    let best: HTMLInputElement | null = null
    let bestScore = Infinity
    for (const el of inputs()) {
      if (el === current) continue
      const r = el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - cx
      const dy = r.top + r.height / 2 - cy
      let primary: number
      let cross: number
      if (dir === 'down') {
        if (dy <= 3) continue
        primary = dy
        cross = Math.abs(dx)
      } else if (dir === 'up') {
        if (dy >= -3) continue
        primary = -dy
        cross = Math.abs(dx)
      } else if (dir === 'right') {
        if (dx <= 3) continue
        primary = dx
        cross = Math.abs(dy)
      } else {
        if (dx >= -3) continue
        primary = -dx
        cross = Math.abs(dy)
      }
      const score = primary + cross * 4
      if (score < bestScore) {
        bestScore = score
        best = el
      }
    }
    return best
  }

  function focusCell(el: HTMLInputElement | null): void {
    if (!el) return
    el.focus()
    el.select()
  }

  function onGridKeydown(e: KeyboardEvent): void {
    const target = e.target
    if (!(target instanceof HTMLInputElement)) return
    const key = e.key
    let dir: Dir | null = null
    if (key === 'ArrowUp') dir = 'up'
    else if (key === 'ArrowDown' || key === 'Enter') dir = 'down'
    else if (key === 'ArrowLeft') {
      if ((target.selectionStart ?? 0) > 0) return
      dir = 'left'
    } else if (key === 'ArrowRight') {
      const len = target.value.length
      if ((target.selectionEnd ?? len) < len) return
      dir = 'right'
    }
    if (!dir) return
    const next = nearest(target, dir)
    if (next) {
      e.preventDefault()
      focusCell(next)
    }
  }

  return { onGridKeydown }
}
