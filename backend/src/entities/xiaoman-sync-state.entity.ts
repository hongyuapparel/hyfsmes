import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface XiaomanSearchCustomer {
  company_id: number;
  serial_id: string;
  name: string;
  short_name: string;
  order_time: string;
  create_time: string;
  contactPerson: string;
  contactNames: string[];
  country: string;
  contactInfo: string;
  version: string;
  fetchedAt: number;
}

/** 单例快照：搜索只读本地数据；失败时不替换上一份完整快照。 */
@Entity('xiaoman_sync_state')
export class XiaomanSyncState {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'json', nullable: true })
  snapshot: XiaomanSearchCustomer[] | null;

  @Column({ name: 'last_success_at', type: 'datetime', nullable: true })
  lastSuccessAt: Date | null;

  @Column({ name: 'last_attempt_at', type: 'datetime', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;
}
