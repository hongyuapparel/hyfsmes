import type { XiaomanCompanyDetail, XiaomanCompanyItem } from './xiaoman.service';
import type { XiaomanSearchCustomer } from '../entities/xiaoman-sync-state.entity';

export function customerProfile(detail: XiaomanCompanyDetail, item?: XiaomanCompanyItem): XiaomanSearchCustomer {
  const contacts = detail.customers ?? detail.contacts ?? [];
  const names = (contact: { name?: string; nickname?: string; nick_name?: string; contact_name?: string }) =>
    [contact.nickname, contact.nick_name, contact.name, contact.contact_name]
      .filter((name): name is string => typeof name === 'string' && !!name.trim()).map((name) => name.trim());
  const main = detail.customers?.find((contact) => contact.main_customer_flag === 1) ?? contacts[0];
  const mainName = detail.main_contact_name?.trim() || detail.main_contact?.name?.trim() || (main ? names(main)[0] : '') ||
    detail.contact_nickname?.trim() || detail.contact_person?.trim() || detail.contact_name?.trim() || detail.linkman?.trim() || '';
  return {
    company_id: detail.company_id,
    serial_id: String(detail.serial_id || detail.company_id).trim(),
    name: detail.name?.trim() || detail.short_name?.trim() || '',
    short_name: detail.short_name ?? '',
    order_time: detail.cooperation_date ?? detail.cooperationDate ?? detail.order_time ?? item?.order_time ?? '',
    create_time: item?.create_time ?? '',
    contactPerson: mainName,
    contactNames: [...new Set([mainName, ...contacts.flatMap(names)].filter(Boolean))],
    country: detail.country_name?.trim() || detail.country || detail.country_region?.country || '',
    contactInfo: Array.isArray(detail.tel) ? detail.tel.filter(Boolean).join('; ') : detail.tel?.trim() ?? '',
    version: `${item?.update_time ?? ''}|${item?.edit_time ?? ''}`,
    fetchedAt: Date.now(),
  };
}
