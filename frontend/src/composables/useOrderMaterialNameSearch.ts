import { ref } from 'vue'
import { getAccessoriesList, getFabricList } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { MaterialRow } from '@/composables/useOrderMaterials'

export interface MaterialNameOption {
  id: number
  name: string
  imageUrl: string
}

type MaterialNameKind = 'fabric' | 'accessory'

type UseOrderMaterialNameSearchOptions = {
  getMaterialTypeLabel: (row: MaterialRow) => string
}

function resolveMaterialNameKind(typeLabel: string): MaterialNameKind | null {
  const label = typeLabel.trim()
  if (label === '主布' || label === '里布' || label === '衬布') return 'fabric'
  if (label === '辅料') return 'accessory'
  return null
}

export function useOrderMaterialNameSearch(options: UseOrderMaterialNameSearchOptions) {
  const materialNameOptions = ref<MaterialNameOption[]>([])
  const materialNameLoading = ref(false)

  async function loadMaterialNames(kind: MaterialNameKind, keyword: string) {
    materialNameLoading.value = true
    try {
      const params = { name: keyword || undefined, skipTotal: true, page: 1, pageSize: 20 }
      const res = kind === 'fabric' ? await getFabricList(params) : await getAccessoriesList(params)
      materialNameOptions.value = (res.data?.list ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl ?? '',
      }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('物料名称下拉加载失败', getErrorMessage(e))
    } finally {
      materialNameLoading.value = false
    }
  }

  function searchMaterialNames(keyword: string, row: MaterialRow) {
    const kind = resolveMaterialNameKind(options.getMaterialTypeLabel(row))
    if (!kind) {
      materialNameOptions.value = []
      return
    }
    void loadMaterialNames(kind, keyword)
  }

  function onMaterialNameVisibleChange(visible: boolean, row: MaterialRow) {
    if (!visible) return
    const kind = resolveMaterialNameKind(options.getMaterialTypeLabel(row))
    if (!kind) {
      materialNameOptions.value = []
      return
    }
    void loadMaterialNames(kind, '')
  }

  return {
    materialNameOptions,
    materialNameLoading,
    searchMaterialNames,
    onMaterialNameVisibleChange,
  }
}
