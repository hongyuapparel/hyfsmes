import type { ReportRule,ManualSection,AutomaticSource } from '@/api/work-reports'
export const isReportScheduled = (rule:ReportRule) => rule.enabled
export const manualSectionLabels:Record<ManualSection,string>={sample:'样品订单（自动列出，可补充安排）',bulk:'大货订单（自动列出，可补充安排）',other:'其他事项 / 特殊说明（选填）'}
export const automaticSourceLabels:Record<AutomaticSource,string>={purchase:'采购待办与当天完成',pattern:'纸样待办与当天完成',cutting:'裁床待办与当天完成',sewing:'车缝待办与当天完成',finishing:'尾部待办与当天完成',warehouse:'仓库待处理与当天出库'}
