import { it,expect } from 'vitest'
import { isReportScheduled } from './workReportSchedule'
it('人员名单只取决于是否需要报告，与模板内容无关',()=>{expect(isReportScheduled({ownerId:1,enabled:true,templateId:'purchase'})).toBe(true);expect(isReportScheduled({ownerId:1,enabled:false,templateId:'purchase'})).toBe(false)})
