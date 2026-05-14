export type FinishingBatchEventType = 'receive' | 'inbound' | 'outbound';

export interface FinishingBatchEvent {
  type: FinishingBatchEventType;
  batchNo: number | null;
  quantity: number;
  sourceType: 'normal' | 'defect' | null;
  operatorUsername: string;
  pickupUserName: string;
  remark: string;
  occurredAt: string; // ISO
}
