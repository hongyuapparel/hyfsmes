export type ManualSection='sample'|'bulk'|'other';
export type AutomaticSource='pattern'|'purchase'|'cutting'|'sewing'|'finishing'|'warehouse';
export interface ReportTemplate { id:string; name:string; manualSections:ManualSection[]; automaticSources:AutomaticSource[] }
export interface ReportRule { ownerId:number; enabled:boolean; templateId:string }
export const defaultReportTemplates=():ReportTemplate[]=>[
 {id:'merchandiser',name:'跟单模板',manualSections:['sample','bulk','other'],automaticSources:[]},
 {id:'finishing',name:'尾部模板',manualSections:['other'],automaticSources:['finishing']},
 {id:'purchase',name:'采购模板',manualSections:['other'],automaticSources:['purchase']},
 {id:'pattern',name:'纸样模板',manualSections:['other'],automaticSources:['pattern']},
 {id:'cutting',name:'裁床模板',manualSections:['other'],automaticSources:['cutting']},
 {id:'sewing',name:'车缝模板',manualSections:['other'],automaticSources:['sewing']},
 {id:'warehouse',name:'仓管模板',manualSections:['other'],automaticSources:['warehouse']},
 {id:'general',name:'通用模板',manualSections:['other'],automaticSources:[]},
];
export function defaultReportTemplateId(codes:string){if(codes.split(',').includes('inventory'))return 'warehouse';return ['merchandiser','finishing','purchase','pattern','cutting','sewing','warehouse'].find(c=>codes.split(',').includes(c))||'general'}
