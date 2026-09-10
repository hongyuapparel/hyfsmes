import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { PurchaseItemRow } from '@/api/production-purchase'
import { usePurchaseRegisterDialog, isRegisterablePurchaseRow } from './usePurchaseRegisterDialog'

const mocks = vi.hoisted(() => ({ register: vi.fn(), edit: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('@/api/production-purchase', () => ({registerPurchaseBatch:mocks.register,editCompletedPurchaseBatch:mocks.edit}))
vi.mock('@/api/suppliers', () => ({searchSuppliers:vi.fn()}))
vi.mock('@/api/request', () => ({getErrorMessage:()=> '错误',isErrorHandled:()=>false}))
vi.mock('element-plus', () => ({ElMessage:{warning:mocks.warning,error:mocks.error,success:vi.fn()}}))

function setup() {
  const row = {orderId:1,materialIndex:0,orderNo:'TEST',skuCode:'TEST',materialName:'布',
    supplierName:'供应商',planQuantity:10,processRoute:'purchase',purchaseStatus:'pending'} as PurchaseItemRow
  const reload=vi.fn(async()=>{}), clearSelection=vi.fn()
  return { ...usePurchaseRegisterDialog({selectedRows:ref([row]),reload,clearSelection}),row,reload }
}
describe('采购登记交互',()=>{
  beforeEach(()=>vi.clearAllMocks())
  it('默认采购中，取消重开清除误改，现货可一次提交完成',async()=>{
    const f=setup(); f.openRegisterDialog();
    expect(f.registerDialog.rows[0].purchaseStatus).toBe('purchasing')
    f.registerDialog.rows[0].actualPurchaseQuantity=99
    f.resetRegisterForm(); f.openRegisterDialog()
    expect(f.registerDialog.rows[0].actualPurchaseQuantity).toBe(10)
    f.registerDialog.rows[0].purchaseStatus='completed'
    await f.submitRegister()
    expect(mocks.register).toHaveBeenCalledWith({items:[expect.objectContaining({purchaseStatus:'completed',actualPurchaseQuantity:10})]})
    expect(f.registerDialog.visible).toBe(false)
    expect(f.reload).toHaveBeenCalledOnce()
  })
  it('缺少供应商不能保存，失败不关闭表单',async()=>{
    const f=setup();f.openRegisterDialog();f.registerDialog.rows[0].supplierName=''
    await f.submitRegister(); expect(mocks.register).not.toHaveBeenCalled();expect(f.registerDialog.visible).toBe(true)
    f.registerDialog.rows[0].supplierName='供应商'
    mocks.register.mockRejectedValueOnce(new Error('failed'))
    await f.submitRegister();expect(f.registerDialog.visible).toBe(true);expect(f.registerDialog.submitting).toBe(false)
  })
  it('采购中不能重复登记；提交期间不能重复发送',async()=>{
    const f=setup();expect(isRegisterablePurchaseRow({...f.row,purchaseStatus:'purchasing'})).toBe(false)
    f.openRegisterDialog();f.registerDialog.submitting=true
    await f.submitRegister();expect(mocks.register).not.toHaveBeenCalled()
  })
  it('清空数量不能作为零保存，明确填写零仍可保存', async () => {
    const f = setup()
    f.openRegisterDialog()
    for (const empty of [null, undefined]) {
      f.registerDialog.rows[0].actualPurchaseQuantity = empty
      await f.submitRegister()
      expect(mocks.register).not.toHaveBeenCalled()
      expect(f.registerDialog.visible).toBe(true)
    }
    f.registerDialog.rows[0].actualPurchaseQuantity = 0
    await f.submitRegister()
    expect(mocks.register).toHaveBeenCalledWith({
      items: [expect.objectContaining({ actualPurchaseQuantity: 0 })],
    })
  })
})
