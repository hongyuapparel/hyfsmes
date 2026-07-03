import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { copyPackingListToDraft, type PackingListRow } from '@/api/packing-lists'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface CopyDialogState {
  visible: boolean
  submitting: boolean
  source: PackingListRow | null
  boxSeqText: string
  remark: string
}

interface ParsedBoxSeqs {
  seqs: number[]
  error: string
}

export function usePackingListCopyToDraft(reload: () => void | Promise<void>) {
  const copyDialog = reactive<CopyDialogState>({
    visible: false,
    submitting: false,
    source: null,
    boxSeqText: '',
    remark: '',
  })

  const copyMaxBox = computed(() => Math.max(1, copyDialog.source?.boxCount ?? 1))
  const parsedBoxSeqs = computed(() => parseBoxSeqText(copyDialog.boxSeqText, copyMaxBox.value))
  const copyRangeCount = computed(() => parsedBoxSeqs.value.seqs.length)

  function parseBoxSeqText(input: string, maxBoxSeq: number): ParsedBoxSeqs {
    const normalized = input
      .trim()
      .replace(/[~～至]/g, '-')
      .replace(/\s*-\s*/g, '-')
      .replace(/[，、；;\s]+/g, ',')
    if (!normalized) return { seqs: [], error: '请填写要拆分的箱号' }

    const seqs = new Set<number>()
    for (const part of normalized.split(',').map((s) => s.trim()).filter(Boolean)) {
      const rangeMatch = part.match(/^(\d+)-(\d+)$/)
      if (rangeMatch) {
        const start = Number(rangeMatch[1])
        const end = Number(rangeMatch[2])
        const from = Math.min(start, end)
        const to = Math.max(start, end)
        const fromError = validateBoxSeq(from, maxBoxSeq)
        if (fromError) return { seqs: [], error: fromError }
        const toError = validateBoxSeq(to, maxBoxSeq)
        if (toError) return { seqs: [], error: toError }
        if (to - from + 1 > 1000) return { seqs: [], error: '一次最多拆分/复制 1000 箱' }
        for (let seq = from; seq <= to; seq++) {
          seqs.add(seq)
        }
        continue
      }

      if (!/^\d+$/.test(part)) return { seqs: [], error: '箱号格式不正确，请输入 1-5 或 1,3,5' }
      const seq = Number(part)
      const error = validateBoxSeq(seq, maxBoxSeq)
      if (error) return { seqs: [], error }
      seqs.add(seq)
    }

    if (!seqs.size) return { seqs: [], error: '请填写要拆分的箱号' }
    if (seqs.size > 1000) return { seqs: [], error: '一次最多拆分/复制 1000 箱' }
    return { seqs: [...seqs].sort((a, b) => a - b), error: '' }
  }

  function validateBoxSeq(seq: number, maxBoxSeq: number): string {
    if (!Number.isSafeInteger(seq) || seq < 1) return '箱号必须是大于 0 的整数'
    if (seq > maxBoxSeq) return `箱号不能超过 ${maxBoxSeq}`
    return ''
  }

  function openCopyDialog(row: PackingListRow) {
    if (row.status !== 'draft') {
      ElMessage.warning('仅草稿装箱单可拆分')
      return
    }
    if (row.boxCount <= 0) {
      ElMessage.warning('该装箱单暂无箱子')
      return
    }
    copyDialog.source = row
    copyDialog.boxSeqText = row.boxCount === 1 ? '1' : `1-${row.boxCount}`
    copyDialog.remark = ''
    copyDialog.visible = true
  }

  async function submitCopyToDraft() {
    if (copyDialog.submitting) return
    const source = copyDialog.source
    if (!source) return
    const parsed = parsedBoxSeqs.value
    if (parsed.error) {
      ElMessage.warning(parsed.error)
      return
    }
    copyDialog.submitting = true
    try {
      const res = await copyPackingListToDraft(source.id, {
        boxSeqs: parsed.seqs,
        remark: copyDialog.remark.trim() || undefined,
      })
      ElMessage.success(`已生成 ${res.data.code}`)
      copyDialog.visible = false
      copyDialog.source = null
      try {
        await reload()
      } catch {
        ElMessage.warning(`已生成 ${res.data.code}，但列表刷新失败，请手动刷新`)
      }
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '生成新草稿失败'))
    } finally {
      copyDialog.submitting = false
    }
  }

  return {
    copyDialog,
    copyRangeCount,
    openCopyDialog,
    submitCopyToDraft,
  }
}
