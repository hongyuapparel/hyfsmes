import request from './request'
import type { DemoOrder, WorkTask, DraftRow } from '@/composables/workReportDemo'
export interface ReportPerson { id:number; name:string; username:string; codes:string; role:string; defaultTemplateId?:string }
export type ManualSection='sample'|'bulk'|'other'
export type AutomaticSource='purchase'|'pattern'|'cutting'|'sewing'|'finishing'|'warehouse'
export interface ReportTemplate { id:string; name:string; manualSections:ManualSection[]; automaticSources:AutomaticSource[] }
export interface ReportRule { ownerId:number; enabled:boolean; templateId:string }
export interface ReportDirectoryPerson extends ReportPerson { rule:ReportRule }
export interface ReportSettings { version:number; configured:boolean; rules:ReportRule[]; templates:ReportTemplate[] }
export const getReportDirectory = () => request.get<{configured:boolean;people:ReportDirectoryPerson[]}>('/work-reports/directory')
export const getReportSettings = () => request.get<ReportSettings & {people:ReportPerson[]}>('/work-reports/settings')
export const saveReportSettings = (version:number,rules:ReportRule[],templates:ReportTemplate[]) => request.put<ReportSettings>('/work-reports/settings',{version,rules,templates})
export interface ReportOrder extends DemoOrder { id:number; merchandiser:string; active:number }
export interface AutomaticPlan {key:string;title:string;date:string}
export interface AutomaticRow {planKey?:string; orderId:number; orderNo:string; sku:string; title:string; time:string; quantity:number|null; factory:string; imageUrl:string;remark?:string;status?:string;customer?:string;materialIndex?:number }
export interface LiveReport { today:string; person:ReportPerson; template:ReportTemplate; version:number; tasks:WorkTask[]; automatic:{title:string;note:string;rows:AutomaticRow[]}[];pendingOrders?:ReportOrder[];historicalMissing:boolean }
export const getReportPeople = () => request.get<ReportPerson[]>('/work-reports/people')
export const getReportOrders = () => request.get<ReportOrder[]>('/work-reports/orders')
export const getLiveReport = (owner:number,date:string) => request.get<LiveReport>('/work-reports/'+owner,{params:{date}})
export const saveReportPlans = (version:number,drafts:DraftRow[],automaticPlans?:AutomaticPlan[],ownerId?:number) => request.put<{version:number;tasks:WorkTask[]}>(ownerId?'/work-reports/'+ownerId+'/plan':'/work-reports/mine',{version,drafts,automaticPlans})
