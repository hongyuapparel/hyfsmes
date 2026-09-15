import { reactive, ref } from 'vue'
import type { FinanceTransferQuery } from '@/api/finance-control'
import { getFinanceAccounts, getFinanceHistory, getFinanceTransfers, setFinanceOpening, reconcileFinanceAccount, reopenFinanceAccount, createFinanceTransfer, voidFinanceTransfer, type FinanceAccountStatus, type FinanceAudit, type FinanceTransfer } from '@/api/finance-control'

export function useFinanceControls() {
  const visible = ref(false); const loading = ref(false)
  const accounts = ref<FinanceAccountStatus[]>([]); const transfers = ref<FinanceTransfer[]>([])
  const audit = reactive({ visible:false, logs:[] as FinanceAudit[] })
  const transferQuery = reactive<FinanceTransferQuery>({page:1,pageSize:20,status:'active',keyword:''})
  const transferTotal = ref(0); const transferLoading = ref(false)
  let requestId = 0
  async function loadTransfers(patch: Partial<FinanceTransferQuery> = {}) {
    Object.assign(transferQuery, patch)
    const current = ++requestId
    transferLoading.value = true
    try {
      const { data } = await getFinanceTransfers({...transferQuery})
      if (current !== requestId) return
      const lastPage = Math.max(1, Math.ceil(data.total / transferQuery.pageSize))
      if (transferQuery.page > lastPage) return await loadTransfers({page:lastPage})
      transfers.value = data.list; transferTotal.value = data.total
    } catch (error) {
      if (current !== requestId) return
      transfers.value = []; transferTotal.value = 0
      throw error
    } finally { if (current === requestId) transferLoading.value = false }
  }
  async function reload() {
    await Promise.all([getFinanceAccounts().then(a => { accounts.value = a.data || [] }),loadTransfers()])
  }
  async function open() { visible.value = true; await reload() }
  async function history(kind: string, id: number) { audit.logs=[]; audit.visible=true; audit.logs=(await getFinanceHistory(kind,id)).data || [] }
  async function saveAccount(id: number, mode: string, body: {date:string;amount:number;reason:string}) {
    if (loading.value) return
    loading.value=true
    try {
      if(mode==='opening') await setFinanceOpening(id,body)
      else if(mode==='reconcile') await reconcileFinanceAccount(id,body)
      else await reopenFinanceAccount(id,body.reason)
      await reload()
    } finally { loading.value=false }
  }
  async function transfer(body: Parameters<typeof createFinanceTransfer>[0]) {
    if(loading.value)return
    loading.value=true
    try { await createFinanceTransfer(body); await reload() } finally {loading.value=false}
  }
  async function cancelTransfer(id: number, reason: string) {
    if(loading.value)return
    loading.value=true
    try {await voidFinanceTransfer(id,reason);await reload()} finally {loading.value=false}
  }
  return { visible, loading, accounts, transfers, transferQuery, transferTotal, transferLoading, loadTransfers, audit, open, history, saveAccount, transfer, cancelTransfer }
}
