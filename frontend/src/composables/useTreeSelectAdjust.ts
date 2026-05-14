import { onUnmounted } from 'vue'

/**
 * el-tree-select 有双重宽度锁：
 * 1. Popper.js 通过 inline min-width 锁定 popper 为触发器宽度；
 * 2. El Plus 在渲染时将 .el-tree 的 inline style 也设为触发器宽度，
 *    导致节点内容始终被限制，即使 popper 变宽也没有效果。
 *
 * 解法：在 visible-change 后，同时扩宽 popper 和 .el-tree 的 inline width。
 * structuralOverhead 通过遍历 tree→popper 之间各层的 padding/border 计算，
 * 而非 popper.offsetWidth - tree.offsetWidth（Popper.js 会先把 popper 扩到触发器宽，导致差值虚大）。
 * El Plus 会在约 100ms 后重置 el-tree 的 inline width；用 MutationObserver 检测并立即还原。
 * El Plus 还会把触发器的 inline style（含 ACTIVE_SELECT_STYLE 注入的
 * --el-text-color-regular: var(--el-color-primary)）镜像给 .el-tree，
 * 导致所有下拉选项继承主色变蓝；在 applyTreeWidth 中一并移除该变量。
 *
 * 重要：必须保证同一 popperClass 同时只有一个 MutationObserver 在工作。
 * 连续快速开关下拉时，每次 visible-change 都会重新计算 targetTree（选中值文字
 * 宽度不同 → 目标宽度不同）。若旧 observer 未彻底清理，多个 observer 会以各自不同
 * 的 targetTree 互相覆盖 .el-tree 的 inline width，触发无限 mutation 循环，主线程卡死。
 * 因此每次调用都要把上一轮的「初始 setTimeout / observer / 2 秒清理 setTimeout」全部取消。
 * applyTreeWidth 另加单轮还原次数上限作为兜底，避免任何极端情况下的死循环。
 */
interface TreeAdjustState {
  initialTimer: ReturnType<typeof setTimeout> | null
  cleanupTimer: ReturnType<typeof setTimeout> | null
  observer: MutationObserver | null
}

/** 单轮内 observer 还原 .el-tree 宽度的次数上限，纯兜底，正常只需 1~2 次 */
const MAX_REVERT_PER_ROUND = 30

export function useTreeSelectAdjust() {
  const stateMap = new Map<string, TreeAdjustState>()

  function teardown(popperClass: string) {
    const state = stateMap.get(popperClass)
    if (!state) return
    if (state.initialTimer) clearTimeout(state.initialTimer)
    if (state.cleanupTimer) clearTimeout(state.cleanupTimer)
    state.observer?.disconnect()
    stateMap.delete(popperClass)
  }

  function adjustTreePopperWidth(popperClass: string) {
    // 彻底清理上一轮，保证同一时刻只有一个 observer 在工作
    teardown(popperClass)

    const state: TreeAdjustState = { initialTimer: null, cleanupTimer: null, observer: null }
    stateMap.set(popperClass, state)

    state.initialTimer = setTimeout(() => {
      state.initialTimer = null

      const popper = document.querySelector<HTMLElement>(`.${popperClass}.el-popper`)
      if (!popper) {
        stateMap.delete(popperClass)
        return
      }
      const tree = popper.querySelector<HTMLElement>('.el-tree')
      if (!tree) {
        stateMap.delete(popperClass)
        return
      }
      const nodes = [...popper.querySelectorAll<HTMLElement>('.el-tree-node__content')]
      if (!nodes.length) {
        stateMap.delete(popperClass)
        return
      }

      let structuralOverhead = 0
      let ancestor: HTMLElement | null = tree.parentElement
      while (ancestor && ancestor !== popper) {
        const cs = getComputedStyle(ancestor)
        structuralOverhead += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
        structuralOverhead += (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
        ancestor = ancestor.parentElement
      }
      const popperCS = getComputedStyle(popper)
      structuralOverhead += (parseFloat(popperCS.paddingLeft) || 0) + (parseFloat(popperCS.paddingRight) || 0)
      structuralOverhead += (parseFloat(popperCS.borderLeftWidth) || 0) + (parseFloat(popperCS.borderRightWidth) || 0)

      let innerOverhead = 8
      for (const node of nodes) {
        const item = node.querySelector<HTMLElement>('.el-select-dropdown__item')
        if (!item || item.scrollWidth > item.offsetWidth) continue
        const pl = parseInt(getComputedStyle(node).paddingLeft) || 0
        const icon = node.querySelector<HTMLElement>('.el-tree-node__expand-icon')
        const iconW = icon ? icon.offsetWidth : 0
        innerOverhead = tree.offsetWidth - pl - iconW - item.offsetWidth
        break
      }

      let maxTreeNeeded = 0
      for (const node of nodes) {
        const item = node.querySelector<HTMLElement>('.el-select-dropdown__item')
        if (!item) continue
        const pl = parseInt(getComputedStyle(node).paddingLeft) || 0
        const icon = node.querySelector<HTMLElement>('.el-tree-node__expand-icon')
        const iconW = icon ? icon.offsetWidth : 0
        maxTreeNeeded = Math.max(maxTreeNeeded, pl + iconW + item.scrollWidth + innerOverhead)
      }

      const targetTree = Math.min(440, Math.max(tree.offsetWidth, maxTreeNeeded + 4))
      const targetPopper = targetTree + structuralOverhead

      popper.style.setProperty('width', `${targetPopper}px`, 'important')
      popper.style.setProperty('min-width', `${targetPopper}px`, 'important')

      const applyTreeWidth = () => {
        tree.style.setProperty('width', `${targetTree}px`, 'important')
        tree.style.setProperty('min-width', 'unset', 'important')
        tree.style.setProperty('flex', 'unset', 'important')
        tree.style.removeProperty('--el-text-color-regular')
      }
      applyTreeWidth()

      let revertCount = 0
      const observer = new MutationObserver(() => {
        if (tree.style.width === `${targetTree}px`) return
        if (revertCount >= MAX_REVERT_PER_ROUND) {
          // 兜底：异常情况下停止还原，宁可宽度不完美也不卡死主线程
          observer.disconnect()
          return
        }
        revertCount += 1
        applyTreeWidth()
      })
      state.observer = observer
      observer.observe(tree, { attributes: true, attributeFilter: ['style'] })

      state.cleanupTimer = setTimeout(() => {
        teardown(popperClass)
      }, 2000)
    }, 0)
  }

  onUnmounted(() => {
    for (const popperClass of [...stateMap.keys()]) {
      teardown(popperClass)
    }
  })

  return { adjustTreePopperWidth }
}
