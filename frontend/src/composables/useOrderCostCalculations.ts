import { computed, type Ref } from 'vue'
import {
  materialAmount,
  processItemAmount,
  productionAmount,
  getMaterialTypeMergeKey,
  normalizeSupplierName,
  sortMaterialRows,
  sortProductionRows,
  type MaterialRow,
  type ProcessItemRow,
  type ProductionRow,
} from '@/utils/order-cost'

interface UseOrderCostCalculationsOptions {
  materialRows: Ref<MaterialRow[]>
  processItemRows: Ref<ProcessItemRow[]>
  productionRows: Ref<ProductionRow[]>
  materialTypeOptions: Ref<Array<{ id: number; label: string }>>
  productionCostMultiplier: Ref<number>
  profitMargin: Ref<number>
}

export function useOrderCostCalculations({
  materialRows,
  processItemRows,
  productionRows,
  materialTypeOptions,
  productionCostMultiplier,
  profitMargin,
}: UseOrderCostCalculationsOptions) {
  const materialTotal = computed(() =>
    materialRows.value.reduce((sum, row) => sum + materialAmount(row), 0),
  )
  const processItemTotal = computed(() =>
    processItemRows.value.reduce((sum, row) => sum + processItemAmount(row), 0),
  )
  const productionProcessBaseTotal = computed(() =>
    productionRows.value.reduce((sum, row) => sum + productionAmount(row), 0),
  )
  const productionProcessTotal = computed(() => productionProcessBaseTotal.value * productionCostMultiplier.value)
  const totalCost = computed(() => materialTotal.value + processItemTotal.value + productionProcessTotal.value)
  const computedExFactoryPrice = computed(() => {
    const cost = totalCost.value
    const margin = Number(profitMargin.value) || 0
    if (margin >= 1) return cost
    return cost / (1 - margin)
  })

  const materialRowsSorted = computed(() => {
    return sortMaterialRows(materialRows.value, materialTypeOptions.value)
  })

  const materialSpanMeta = computed(() => {
    const rows = materialRowsSorted.value
    const typeRowspanByIndex = new Map<number, number>()
    const supplierRowspanByIndex = new Map<number, number>()
    const hiddenTypeIndexes = new Set<number>()
    const hiddenSupplierIndexes = new Set<number>()

    let i = 0
    while (i < rows.length) {
      const typeKey = getMaterialTypeMergeKey(rows[i])
      let j = i + 1
      while (typeKey && j < rows.length && getMaterialTypeMergeKey(rows[j]) === typeKey) j += 1
      const typeSpan = j - i
      typeRowspanByIndex.set(i, typeSpan)
      for (let k = i + 1; k < j; k += 1) hiddenTypeIndexes.add(k)

      let p = i
      while (p < j) {
        const supplier = normalizeSupplierName(rows[p].supplierName)
        let q = p + 1
        while (supplier && q < j && normalizeSupplierName(rows[q].supplierName) === supplier) q += 1
        const supplierSpan = q - p
        supplierRowspanByIndex.set(p, supplierSpan)
        for (let k = p + 1; k < q; k += 1) hiddenSupplierIndexes.add(k)
        p = q
      }
      i = j
    }

    return {
      typeRowspanByIndex,
      supplierRowspanByIndex,
      hiddenTypeIndexes,
      hiddenSupplierIndexes,
    }
  })

  const productionRowsSorted = computed(() => {
    return sortProductionRows(productionRows.value)
  })

  const productionSpanMeta = computed(() => {
    const rows = productionRowsSorted.value
    const deptRowspanByIndex = new Map<number, number>()
    const jobRowspanByIndex = new Map<number, number>()
    const deptAmountByIndex = new Map<number, number>()
    const jobAmountByIndex = new Map<number, number>()
    const hiddenDeptIndexes = new Set<number>()
    const hiddenJobIndexes = new Set<number>()

    let i = 0
    while (i < rows.length) {
      const dept = (rows[i].department ?? '').toString()
      let j = i + 1
      while (j < rows.length && (rows[j].department ?? '').toString() === dept) j += 1
      const deptSpan = j - i
      deptRowspanByIndex.set(i, deptSpan)
      const deptAmount = rows.slice(i, j).reduce((sum, row) => sum + productionAmount(row), 0)
      deptAmountByIndex.set(i, deptAmount)
      for (let k = i + 1; k < j; k += 1) hiddenDeptIndexes.add(k)

      let p = i
      while (p < j) {
        const job = (rows[p].jobType ?? '').toString()
        let q = p + 1
        while (
          q < j
          && (rows[q].department ?? '').toString() === dept
          && (rows[q].jobType ?? '').toString() === job
        ) q += 1
        const jobSpan = q - p
        jobRowspanByIndex.set(p, jobSpan)
        const jobAmount = rows.slice(p, q).reduce((sum, row) => sum + productionAmount(row), 0)
        jobAmountByIndex.set(p, jobAmount)
        for (let k = p + 1; k < q; k += 1) hiddenJobIndexes.add(k)
        p = q
      }
      i = j
    }

    return {
      deptRowspanByIndex,
      jobRowspanByIndex,
      deptAmountByIndex,
      jobAmountByIndex,
      hiddenDeptIndexes,
      hiddenJobIndexes,
    }
  })

  function materialSpanMethod({
    columnIndex,
    rowIndex,
  }: {
    row: MaterialRow
    columnIndex: number
    rowIndex: number
  }): { rowspan: number; colspan: number } {
    const meta = materialSpanMeta.value
    if (columnIndex === 0) {
      if (meta.hiddenTypeIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.typeRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    if (columnIndex === 1) {
      if (meta.hiddenSupplierIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.supplierRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    return { rowspan: 1, colspan: 1 }
  }

  function productionSpanMethod({
    columnIndex,
    rowIndex,
  }: {
    row: ProductionRow
    columnIndex: number
    rowIndex: number
  }): { rowspan: number; colspan: number } {
    const meta = productionSpanMeta.value
    if (columnIndex === 1) {
      if (meta.hiddenDeptIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.deptRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    if (columnIndex === 2) {
      if (meta.hiddenJobIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.jobRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    if (columnIndex === 6) {
      if (meta.hiddenJobIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.jobRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    if (columnIndex === 7) {
      if (meta.hiddenDeptIndexes.has(rowIndex)) return { rowspan: 0, colspan: 0 }
      return { rowspan: meta.deptRowspanByIndex.get(rowIndex) ?? 1, colspan: 1 }
    }
    return { rowspan: 1, colspan: 1 }
  }

  function getJobTypeGroupAmountByRowIndex(rowIndex: number): number {
    return productionSpanMeta.value.jobAmountByIndex.get(rowIndex) ?? 0
  }

  function getDepartmentGroupAmountByRowIndex(rowIndex: number): number {
    return productionSpanMeta.value.deptAmountByIndex.get(rowIndex) ?? 0
  }

  return {
    materialTotal,
    processItemTotal,
    productionProcessBaseTotal,
    productionProcessTotal,
    totalCost,
    computedExFactoryPrice,
    materialRowsSorted,
    productionRowsSorted,
    materialSpanMethod,
    productionSpanMethod,
    getJobTypeGroupAmountByRowIndex,
    getDepartmentGroupAmountByRowIndex,
  }
}
