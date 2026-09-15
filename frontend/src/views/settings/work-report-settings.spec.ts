import { beforeEach,describe,it,expect,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import { defineComponent,h,KeepAlive } from 'vue'
import ElementPlus,{ ElCheckbox,ElSelect,ElCheckboxGroup } from 'element-plus'
const api=vi.hoisted(()=>({getReportSettings:vi.fn(),saveReportSettings:vi.fn()}))
vi.mock('@/api/work-reports',()=>api)
vi.mock('@/api/request',()=>({getErrorMessage:()=> '保存失败'}))
vi.mock('vue-router',()=>({useRouter:()=>({push:vi.fn()}),onBeforeRouteLeave:vi.fn()}))
import Settings from './work-report-settings.vue'
describe('报告设置页面交互',()=>{
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}})
  api.getReportSettings.mockResolvedValue({data:{version:1,configured:true,people:[{id:1,name:'跟单甲',role:'跟单',codes:'merchandiser'},{id:2,name:'纸样乙',role:'纸样',codes:'pattern'}],rules:[{ownerId:2,enabled:true,templateId:'pattern'}],templates:[{id:'general',name:'通用模板',manualSections:['other'],automaticSources:[]},{id:'pattern',name:'纸样模板',manualSections:['other'],automaticSources:['pattern']}]}})
  api.saveReportSettings.mockImplementation(async(version,rules,templates)=>({data:{version:version+1,configured:true,rules,templates}}))
 })
 async function open(){const wrapper=mount(defineComponent(()=>()=>h(KeepAlive,null,{default:()=>h(Settings)})),{attachTo:document.body,global:{plugins:[ElementPlus],stubs:{AppDialog:true}}});await flushPromises();return wrapper}
 it('默认查看，点击编辑勾选报告，取消恢复，保存后返回查看',async()=>{
  const wrapper=await open()
  try {
   const button=(text:string)=>wrapper.findAll('button').find(b=>b.text()===text)!
   expect(button('编辑')).toBeDefined();expect(button('保存设置')).toBeUndefined()
   expect(wrapper.findAllComponents(ElCheckbox)).toHaveLength(0);expect(wrapper.text()).not.toContain('手动截止时间');expect(wrapper.text()).not.toContain('手动报告日')
   await button('编辑').trigger('click')
   const auto=()=>wrapper.findAllComponents(ElCheckbox)[0]
   await auto().get('input').setValue(true);expect(auto().props('modelValue')).toBe(true)
   await button('取消').trigger('click');expect(api.saveReportSettings).not.toHaveBeenCalled();expect(wrapper.findAllComponents(ElCheckbox)).toHaveLength(0)
   await button('编辑').trigger('click');expect(auto().props('modelValue')).toBe(false)
   await auto().get('input').setValue(true);await button('保存设置').trigger('click');await flushPromises()
   expect(api.saveReportSettings.mock.calls[0][1].find((r:{ownerId:number})=>r.ownerId===1).enabled).toBe(true)
   expect(wrapper.findAllComponents(ElCheckbox)).toHaveLength(0);expect(button('编辑')).toBeDefined();expect(wrapper.text()).toContain('设置已保存')
  }finally{wrapper.unmount()}
 })
 it('岗位和姓名是独立选择框，组合筛选后可以重置',async()=>{
  const wrapper=await open()
  try {
   const selects=wrapper.findAllComponents(ElSelect);expect(selects).toHaveLength(2)
   selects[0].vm.$emit('update:modelValue','纸样');await flushPromises()
   expect(wrapper.findAll('tbody tr')).toHaveLength(1)
   selects[1].vm.$emit('update:modelValue',1);await flushPromises();expect(wrapper.text()).toContain('没有符合筛选条件的人员')
   await wrapper.findAll('button').find(b=>b.text()==='重置')!.trigger('click');await flushPromises();expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  }finally{wrapper.unmount()}
 })
 it('只选择岗位数据，不再配置独立模板',async()=>{
  const wrapper=await open();try{
   expect(wrapper.text()).not.toContain('模板配置')
   expect(wrapper.text()).toContain('岗位数据')
   await wrapper.findAll('button').find(b=>b.text()==='编辑')!.trigger('click')
   const select=wrapper.findAllComponents(ElSelect)[2]
   select.vm.$emit('update:modelValue','pattern');await flushPromises()
   await wrapper.findAll('button').find(b=>b.text()==='保存设置')!.trigger('click');await flushPromises()
   expect(api.saveReportSettings.mock.calls[0][1].find((r:{ownerId:number})=>r.ownerId===1).templateId).toBe('pattern')
   expect(wrapper.text()).toContain('纸样数据')
  }finally{wrapper.unmount()}
 })
})
