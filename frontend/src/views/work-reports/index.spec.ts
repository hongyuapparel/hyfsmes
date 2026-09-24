import { beforeEach,it,expect,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import { defineComponent,h,KeepAlive } from 'vue'
import ElementPlus from 'element-plus'
const api=vi.hoisted(()=>({getReportDirectory:vi.fn(),getReportOrders:vi.fn(),getLiveReport:vi.fn(),saveReportPlans:vi.fn()}))
vi.mock('@/api/work-reports',()=>api)
vi.mock('@/api/request',()=>({getErrorMessage:()=> '读取失败'}))
const auth=vi.hoisted(()=>({user:{id:1,displayName:'采购甲',username:'purchase',roleCode:'purchase'}}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>auth}))
vi.mock('vue-router',()=>({useRouter:()=>({push:vi.fn()}),onBeforeRouteLeave:vi.fn()}))
import Page from './index.vue'
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())
const person={id:1,name:'采购甲',username:'purchase',codes:'purchase',role:'采购',rule:{ownerId:1,enabled:true,templateId:'purchase'}}
const row={planKey:'purchase:12:0',orderId:12,orderNo:'TEST-12',sku:'款式12',title:'面料',time:today,quantity:10,factory:'',imageUrl:'',status:'等待采购',remark:''}
const report=()=>({today,person,version:0,tasks:[],historicalMissing:false,template:{id:'purchase',name:'采购模板',manualSections:['other'],automaticSources:['purchase']},automatic:[{title:'当前待采购（部门）',note:'与采购页一致',rows:[row]}]})
beforeEach(()=>{auth.user.roleCode='purchase';vi.resetAllMocks();vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[person]}});api.getReportOrders.mockResolvedValue({data:[]});api.getLiveReport.mockResolvedValue({data:report()});api.saveReportPlans.mockResolvedValue({data:{version:1,tasks:[]}})})
async function open(){const w=mount(defineComponent(()=>()=>h(KeepAlive,null,{default:()=>h(Page)})),{attachTo:document.body,global:{plugins:[ElementPlus],stubs:{AppDialog:true,AppImageThumb:true}}});await flushPromises();return w}
it('采购自动清单正常显示，无需先填计划；补充说明选填且可保存',async()=>{
 const w=await open();try{
  expect(w.text()).toContain('TEST-12');expect(w.findAll('article .toolbar section')).toHaveLength(0);expect(api.saveReportPlans).not.toHaveBeenCalled()
  expect(w.text()).not.toContain('样品 · 工作安排');expect(w.text()).not.toContain('大货 · 工作安排')
  await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises()
  await w.get('textarea').setValue('TEST-12 · 面料：等待供应商回复');await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
  expect(api.saveReportPlans.mock.calls[0][2][0].title).toBe('TEST-12 · 面料：等待供应商回复');expect(api.saveReportPlans.mock.calls[0][2][0].date).toBe('');expect(api.saveReportPlans.mock.calls[0][1]).toEqual([])
 }finally{w.unmount()}
})
it('尾部模板在查看和编辑时都没有样品板块',async()=>{
 api.getLiveReport.mockResolvedValue({data:{...report(),automatic:[],template:{id:'finishing',name:'尾部模板',manualSections:['bulk','other'],automaticSources:[]}}})
 const w=await open();try{expect(w.text()).not.toContain('样品');expect(w.text()).toContain('大货');await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises();expect(w.text()).not.toContain('样品');expect(w.text()).toContain('大货')}finally{w.unmount()}
})

it('管理员可编辑他人报告，保存后可以再次编辑',async()=>{
 auth.user.roleCode='admin';const other={...person,id:2,rule:{...person.rule,ownerId:2}};api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[other]}});api.getLiveReport.mockResolvedValue({data:{...report(),person:other}})
 const w=await open();try{await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises();await w.get('textarea').setValue('管理员代填');await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises();expect(api.saveReportPlans.mock.calls[0][3]).toBe(2);await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises();expect(w.findAll('button').some(b=>b.text()==='保存')).toBe(true)}finally{w.unmount()}
})

it('四千订单、112行跟单安排编辑时不会逐行渲染全部订单选项，仍可保存填写的行',async()=>{
 const catalog=Array.from({length:4103},(_,i)=>({id:i+1,no:'ORDER-'+i,sku:'款'+i,customer:'客户',orderType:i<3000?'sample':'bulk',active:1,merchandiser:person.name,imageUrl:''}))
 const pendingOrders=[...catalog.slice(0,76),...catalog.slice(3000,3036)]
 api.getReportOrders.mockResolvedValue({data:catalog})
 api.getLiveReport.mockResolvedValue({data:{...report(),automatic:[],pendingOrders,template:{id:'merchandiser',name:'跟单模板',manualSections:['sample','bulk','other'],automaticSources:[]}}})
 const w=await open();try{
  await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises()
  expect(w.findAll('textarea')).toHaveLength(112)
  expect(document.querySelectorAll('[role="option"]').length).toBe(0)
  await w.findAll('textarea')[0].setValue('确认尺寸并交纸样')
  const dateInput=w.get('input[aria-label="sample第2行预计日期"]')
  await dateInput.setValue(today);await dateInput.trigger('change')
  await flushPromises()
  await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
  expect(api.saveReportPlans.mock.calls[0][1]).toHaveLength(2)
  expect(api.saveReportPlans.mock.calls[0][1][0].order).toBe('ORDER-0')
  expect(api.saveReportPlans.mock.calls[0][1][0].date).toBe('')
  expect(api.saveReportPlans.mock.calls[0][1][1].title).toBe('')
  expect(api.saveReportPlans.mock.calls[0][1][1].date).toBe(today)
  expect(w.text()).toContain('全部安排已保存')
 }finally{w.unmount()}
},20000)

it('隔夜返回今天，历史待办不显示为零，且可以回到今天',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-14T12:00:00+08:00'))
 api.getLiveReport.mockImplementation((_id,date)=>Promise.resolve({data:{...report(),today:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),automatic:[{title:'当前裁床待办（部门）',note:'历史日期没有快照',rows:date==='2026-09-15'?[row]:[]}]}}))
 const w=await open();try{
  vi.setSystemTime(new Date('2026-09-15T08:00:00+08:00'));window.dispatchEvent(new Event('focus'));await flushPromises()
  expect(api.getLiveReport.mock.lastCall?.[1]).toBe('2026-09-15')
  await w.findAll('button.person').filter(b=>b.text().includes('采购甲'))[1].trigger('click');await flushPromises()
  expect(w.text()).toContain('未保存历史快照');expect(w.text()).not.toContain('当前裁床待办（部门） · 0 条')
  await w.findAll('button').find(b=>b.text()==='回到今天')!.trigger('click');await flushPromises()
  expect(api.getLiveReport.mock.lastCall?.[1]).toBe('2026-09-15')
 }finally{w.unmount();vi.useRealTimers()}
})

it('自动待办按执行日期排序，编辑日期不跳行，保存后重排',async()=>{
 const rows=[1,2,3].map(n=>({...row,orderId:n,orderNo:'SORT-'+n,planKey:'sort:'+n}))
 const tasks=[{id:'t1',automaticKey:'sort:1',date:'2099-01-02',title:''},{id:'t2',automaticKey:'sort:2',date:'2099-01-01',title:''}]
 api.getLiveReport.mockResolvedValue({data:{...report(),tasks,automatic:[{title:'当前待采购（部门）',note:'',rows}]}})
 const w=await open();try{
 const order=()=>w.findAll('article .el-table__body-wrapper tbody tr').slice(0,3).map(r=>r.text().match(/SORT-\d/)?.[0])
 expect(order()).toEqual(['SORT-2','SORT-1','SORT-3'])
 await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises()
 const dateInput=w.get('input[aria-label="bulk第1行预计日期"]');await dateInput.setValue('2099-01-03');await dateInput.trigger('change');await flushPromises()
 expect(order()).toEqual(['SORT-2','SORT-1','SORT-3'])
 api.saveReportPlans.mockResolvedValue({data:{version:1,tasks:[tasks[0],{...tasks[1],date:'2099-01-03'}]}})
 await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
 expect(order()).toEqual(['SORT-1','SORT-2','SORT-3'])
 }finally{w.unmount()}
})
it('普通账号可查看他人报告，但没有编辑及报告设置入口',async()=>{
 const other={...person,id:2,name:'其他部门'}
 api.getReportDirectory.mockResolvedValue({data:{configured:true,people:[other]}});api.getLiveReport.mockResolvedValue({data:{...report(),person:other}})
 const w=await open();try{expect(w.text()).toContain('其他部门');expect(w.text()).toContain('TEST-12');expect(w.findAll('button').some(b=>['编辑','报告设置'].includes(b.text()))).toBe(false)}finally{w.unmount()}
})

it('过期计划有提醒和筛选，已结束订单单独提示并保持完成操作',async()=>{
 const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const tasks=[{id:'old',order:'OLD',orders:['OLD'],owner:'1',section:'sample',title:'跟进',date:yesterday,status:'todo',history:[]},{id:'now',order:'NOW',orders:['NOW'],owner:'1',section:'sample',title:'今天',date:today,status:'todo',history:[]}];
 api.getReportOrders.mockResolvedValue({data:[{no:'OLD',sku:'A',finished:1,orderType:'sample'},{no:'NOW',sku:'B',finished:0,orderType:'sample'}]});api.getLiveReport.mockResolvedValue({data:{...report(),tasks,automatic:[],template:{id:'merchandiser',manualSections:['sample'],automaticSources:[]}}});
 const w=await open();try{expect(w.text()).toContain('逾期 1 天');expect(w.text()).toContain('订单已结束，请确认安排是否结束');await w.findAll('button').find(b=>b.text()==='逾期待处理 1 项')!.trigger('click');expect(w.get('.plan-table').text()).not.toContain('NOW · B');await w.findAll('button').find(b=>b.text()==='编辑')!.trigger('click');await flushPromises();expect(w.text()).toContain('NOW · B');expect(w.text()).toContain('结束跟进');expect(w.text()).toContain('需要协助')}finally{w.unmount()}
})
