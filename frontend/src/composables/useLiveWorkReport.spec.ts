import { describe,it,expect,vi } from 'vitest'
const api=vi.hoisted(()=>({getReportSubmissions:vi.fn().mockResolvedValue({data:[]}),getReportDirectory:vi.fn(),getReportOrders:vi.fn(),getLiveReport:vi.fn(),saveReportPlans:vi.fn()}))
vi.mock('@/api/work-reports',()=>api)
vi.mock('@/api/request',()=>({getErrorMessage:()=> '读取失败'}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({user:{id:1,displayName:'纸样乙',username:'pattern'}})}))
import { useLiveWorkReport } from './useLiveWorkReport'
import { reportCalendarDay } from './workReportSchedule'
import { beijingCalendarDay } from '../../../backend/src/common/date-time.util'

it('报告日期不依赖浏览器地区支持，北京时间跨日仍为有效 ISO 日期',()=>{
 const locale=vi.spyOn(Intl,'DateTimeFormat').mockImplementation(()=>{throw new Error('unsupported locale')})
 try {
  expect(reportCalendarDay(new Date('2026-10-02T15:59:59Z'))).toBe('2026-10-02')
  expect(reportCalendarDay(new Date('2026-10-02T16:00:00Z'))).toBe('2026-10-03')
  expect(reportCalendarDay(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
  expect(beijingCalendarDay(new Date('2026-10-02T16:00:00Z'))).toBe('2026-10-03')
  expect(useLiveWorkReport().date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
 } finally {locale.mockRestore()}
})
describe('报告设置返回缓存页',()=>{
 it('同一个人的报告方式改变后，名单及右侧内容同步，不重置所选日期',async()=>{
  const person={id:1,name:'纸样乙',username:'pattern',role:'纸样',codes:'pattern',rule:{ownerId:1,enabled:true,templateId:'general'}}
  api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[person]}})
  api.getReportOrders.mockResolvedValue({data:[]})
  api.getLiveReport.mockResolvedValue({data:{today:'2026-09-14',person,template:{id:'pattern',name:'纸样模板',manualSections:['other'],automaticSources:['pattern']},version:0,tasks:[],automatic:[]}})
  const s=useLiveWorkReport();s.date.value='2026-09-14';await s.init();expect(s.report.value?.automatic).toEqual([])
  api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[{...person,rule:{...person.rule,templateId:'pattern'}}]}})
  api.getLiveReport.mockResolvedValue({data:{today:'2026-09-14',person,version:0,tasks:[],automatic:[{title:'今日纸样完成',rows:[]}]}})
  await s.refreshDirectory();expect(s.owner.value).toBe(1);expect(s.date.value).toBe('2026-09-14');expect(s.people.value[0].rule.templateId).toBe('pattern');expect(s.report.value?.automatic[0].title).toBe('今日纸样完成');expect(api.getLiveReport).toHaveBeenCalledTimes(2)
 })
})

it('自动列出未安排订单，编辑带入全部订单，只保存填写的行',async()=>{
 const person={id:1,name:'纸样乙',username:'pattern',role:'跟单',codes:'merchandiser',rule:{ownerId:1,enabled:true,templateId:'merchandiser'}}
 const orders=[{id:11,no:'A',orderType:'sample',active:1,merchandiser:'纸样乙'},{id:12,no:'B',orderType:'bulk',active:1,merchandiser:'纸样乙'}]
 api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[person]}});api.getReportOrders.mockResolvedValue({data:orders})
 api.getLiveReport.mockResolvedValue({data:{today:'2026-09-14',person,template:{id:'merchandiser',manualSections:['sample','bulk','other'],automaticSources:[]},version:0,tasks:[],automatic:[],pendingOrders:orders}})
 const s=useLiveWorkReport();await s.init();expect(s.sections.value[0].rows[0].order).toBe('A');expect(s.sections.value[1].rows[0].order).toBe('B')
 s.edit();expect(s.drafts.value).toHaveLength(2);s.drafts.value[0].title='核对尺寸';api.saveReportPlans.mockResolvedValue({data:{version:1,tasks:[]}})
 await s.save();expect(api.saveReportPlans.mock.lastCall?.[1]).toHaveLength(1);expect(api.saveReportPlans.mock.lastCall?.[1][0].order).toBe('A')
})

it('打开和进入编辑不计已交，提交后名单立即更新，再次编辑不重复计数',async()=>{
 const person={id:1,name:'纸样乙',username:'pattern',role:'纸样',codes:'pattern',rule:{ownerId:1,enabled:true,templateId:'pattern'}}
 const task={id:'previous',owner:'1',order:'',orders:[],section:'other',title:'上次安排',date:'2026-09-30',status:'todo',completedDate:'',history:[]}
 api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[person]}});api.getReportOrders.mockResolvedValue({data:[]});api.getReportSubmissions.mockResolvedValue({data:[{ownerId:1,reportDate:'2026-09-30'}]})
 api.getLiveReport.mockResolvedValue({data:{today:'2026-10-01',submitted:false,person,template:{id:'pattern',manualSections:['other'],automaticSources:[]},version:1,tasks:[task],automatic:[]}})
 const s=useLiveWorkReport();s.date.value='2026-10-01';s.listDate.value='2026-10-01';await s.init();s.edit()
 expect(s.report.value?.submitted).toBe(false);expect(s.submissions.value).toHaveLength(1);expect(s.drafts.value[0]).toMatchObject({title:'上次安排',date:'2026-09-30'})
 api.saveReportPlans.mockRejectedValueOnce(new Error('failed'));expect(await s.save()).toBe(false);expect(s.editing.value).toBe(true);expect(s.submissions.value).toHaveLength(1)
 api.saveReportPlans.mockResolvedValue({data:{version:2,tasks:[task],submitted:true}});expect(await s.save()).toBe(true);expect(s.report.value?.submitted).toBe(true);expect(s.submissions.value).toHaveLength(2)
 expect(api.saveReportPlans.mock.lastCall?.[4]).toBe('2026-10-01');s.edit();await s.save();expect(s.submissions.value).toHaveLength(2)
})
