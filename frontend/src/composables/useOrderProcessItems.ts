import { ref } from 'vue'

export interface ProcessRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
}

export function useOrderProcessItems() {
  const processItems = ref<ProcessRow[]>([])

  function addProcessRow() {
    processItems.value.push({})
  }

  function removeProcessRow(index: number) {
    processItems.value.splice(index, 1)
  }

  return {
    processItems,
    addProcessRow,
    removeProcessRow,
  }
}
