import { beforeEach,it,expect,vi } from 'vitest'
const api=vi.hoisted(()=>({getReportSettings:vi.fn(),saveReportSettings:vi.fn()}))
vi.mock('@/api/work-reports',()=>api)
vi.mock('@/api/request',()=>({getErrorMessage:()=> '保存冲突'}))
import { useWorkReportSettings } from './useWorkReportSettings'
beforeEach(()=>{vi.resetAllMocks();api.getReportSettings.mockResolvedValue({data:{version:0,configured:false,rules:[],templates:[{id:'purchase',name:'采购模板',manualSections:['other'],automaticSources:['purchase']}],people:[{id:1,name:'采购甲',role:'采购',codes:'purchase',defaultTemplateId:'purchase'},{id:2,name:'跟单乙',role:'跟单',codes:'merchandiser',defaultTemplateId:'merchandiser'}]}})})
it('只读进入，勾选人员选择模板，筛选不丢草稿，保存后只读',async()=>{
 const s=useWorkReportSettings();await s.load();expect(s.editing.value).toBe(false);s.edit();s.rows.value[0].enabled=true;s.roleFilter.value='采购';expect(s.visibleRows.value).toHaveLength(1)
 api.saveReportSettings.mockImplementation(async(version,rules,templates)=>({data:{version:version+1,rules,templates,configured:true}}))
 expect(await s.save()).toBe(true);expect(api.saveReportSettings.mock.calls[0][1]).toHaveLength(2);expect(api.saveReportSettings.mock.calls[0][1][0]).toEqual({ownerId:1,enabled:true,templateId:'purchase'});expect(s.editing.value).toBe(false)
})
it('模板同时支持手动和自动，取消一起恢复人员与模板',async()=>{
 const s=useWorkReportSettings();await s.load();s.edit();s.rows.value[0].enabled=true;s.templates.value[0].manualSections.push('bulk');expect(s.dirty.value).toBe(true);s.cancel();expect(s.rows.value[0].enabled).toBe(false);expect(s.templates.value[0].manualSections).toEqual(['other']);expect(s.templates.value[0].automaticSources).toEqual(['purchase']);expect(s.dirty.value).toBe(false)
})
it('冲突保留模板草稿，岗位与姓名独立筛选可清空',async()=>{
 const s=useWorkReportSettings();await s.load();s.edit();s.rows.value[0].enabled=true;s.roleFilter.value='采购';s.personFilter.value=2;expect(s.visibleRows.value).toHaveLength(0);s.resetFilters();expect(s.visibleRows.value).toHaveLength(2);api.saveReportSettings.mockRejectedValue(new Error('409'));expect(await s.save()).toBe(false);expect(s.dirty.value).toBe(true)
})
