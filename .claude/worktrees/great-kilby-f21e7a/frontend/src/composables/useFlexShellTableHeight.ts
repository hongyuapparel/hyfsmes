import { type Ref, ref } from 'vue'

/**
 * 列表页表格高度：与 flex 布局壳配合。可选传入 tableRef 供后续扩展（测量/resize）。
 */
export function useFlexShellTableHeight(
  _shellRef: Ref<HTMLElement | null>,
  _options?: { tableRef?: Ref<unknown> },
) {
  const tableHeight = ref<number | undefined>(undefined)
  return { tableHeight }
}
