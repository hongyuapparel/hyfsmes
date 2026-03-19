import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_BASE_URL = 'https://api.xiaoman.cn';

export interface XiaomanCompanyItem {
  company_id: number;
  serial_id: string;
  name: string;
  short_name: string;
  order_time: string;
  create_time: string;
}

export interface XiaomanCompanyDetail {
  company_id: number;
  serial_id: string;
  name: string;
  short_name?: string;
  country?: string;
  country_region?: { country?: string; province?: string; city?: string };
  order_time?: string;
  tel?: string[];
  product_group_ids?: number[];
  product_group_names?: string;
  /** 主联系人姓名（字段名按小满返回结构做 best effort 兼容） */
  main_contact_name?: string;
  main_contact?: { name?: string } | null;
  contacts?: { name?: string; nickname?: string; nick_name?: string }[] | null;
  customers?: {
    customer_id?: number;
    name?: string;
    nickname?: string;
    nick_name?: string;
    main_customer_flag?: number;
  }[];
}

@Injectable()
export class XiaomanService {
  private token: string | null = null;
  private tokenExpiry = 0;
  private companyListCache: { list: XiaomanCompanyItem[]; fetchedAt: number } | null = null;
  private companyListCacheTtlMs = 10 * 60 * 1000; // 10 分钟

  constructor(private config: ConfigService) {}

  /**
   * 小满 company/list 返回字段在不同账号下会有差异，关键词匹配不能只依赖固定 3 个字段。
   * 这里对条目里所有可序列化文本做宽松匹配，确保“在小满能搜到”的数据尽量都能被命中。
   */
  private matchesKeyword(item: XiaomanCompanyItem, lowerKeyword: string): boolean {
    const anyItem = item as unknown as Record<string, unknown>
    for (const value of Object.values(anyItem)) {
      if (value == null) continue
      if (typeof value === 'string' || typeof value === 'number') {
        if (String(value).toLowerCase().includes(lowerKeyword)) return true
        continue
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          if ((typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(lowerKeyword)) {
            return true
          }
        }
        continue
      }
      if (typeof value === 'object') {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if ((typeof nested === 'string' || typeof nested === 'number') && String(nested).toLowerCase().includes(lowerKeyword)) {
            return true
          }
        }
      }
    }
    return false
  }

  private getBaseUrl(): string {
    return this.config.get<string>('XIAOMAN_API_BASE_URL') ?? process.env.XIAOMAN_API_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.tokenExpiry > now + 60000) return this.token;

    const clientId = this.config.get<string>('XIAOMAN_CLIENT_ID') ?? process.env.XIAOMAN_CLIENT_ID;
    const clientSecret = this.config.get<string>('XIAOMAN_CLIENT_SECRET') ?? process.env.XIAOMAN_CLIENT_SECRET;
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new Error('请配置 .env 中的 XIAOMAN_CLIENT_ID 和 XIAOMAN_CLIENT_SECRET（需重启后端生效）');
    }

    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/v1/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'company',
      }),
    });
    const text = await res.text();
    let data: { access_token?: string; expires_in?: number; message?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`小满鉴权失败：响应格式异常 HTTP ${res.status}，请确认 XIAOMAN_API_BASE_URL 与密钥正确`);
    }
    if (!data.access_token) {
      const msg = data.message || '小满鉴权失败，请检查 client_id 和 client_secret 是否从小满 CRM 正确复制';
      throw new Error(msg);
    }
    this.token = data.access_token;
    this.tokenExpiry = now + (data.expires_in ?? 28800) * 1000;
    return this.token;
  }

  async getCompanyList(
    page = 1,
    pageSize = 20,
    keyword?: string,
  ): Promise<{ list: XiaomanCompanyItem[]; total: number }> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const kw = keyword?.trim();
    const hasKeyword = !!kw;

    // 只取「客户列表」中的客户（all=0 排除公海）
    // const baseParams = '&removed=0&all=0';
    const baseParams = '&all=0';

    // 有搜索关键词：由于小满接口文档未说明 keyword 的行为，实际测试发现它并不会稳定按关键字过滤，
    // 所以这里改为「拉取客户列表（all=0）+ 本地模糊匹配」。
    // 为了避免多次请求导致的超时/断线，这里加缓存 + 多页拉取重试 + 失败降级（不让前端直接报错）。
    if (hasKeyword) {
      // 优先使用小满服务端 keyword 搜索（更贴近小满页面行为，且更快）
      // 若该账号下 keyword 行为不稳定，再降级到本地全量过滤。
      try {
        const startIndex = page
        const directUrl =
          `${baseUrl}/v1/company/list?count=${pageSize}&start_index=${startIndex}${baseParams}` +
          `&keyword=${encodeURIComponent(kw)}`
          console.log(directUrl)
        const directRes = await fetch(directUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const directText = await directRes.text()
        const directJson = JSON.parse(directText) as {
          code?: number
          data?: { list?: XiaomanCompanyItem[]; totalItem?: number }
        }
        if (directJson.code === 200 && directJson.data) {
          const directList = directJson.data.list ?? []
          const directTotal = directJson.data.totalItem ?? directList.length
          if (directTotal > 0) {
            return { list: directList, total: directTotal }
          }
        }
      } catch {
        // 直连 keyword 失败时静默降级到本地过滤，避免影响主流程
      }

      const now = Date.now()
      if (this.companyListCache && now - this.companyListCache.fetchedAt < this.companyListCacheTtlMs) {
        const all = this.companyListCache.list
        const lower = kw.toLowerCase()
        const filtered = all.filter((c) => this.matchesKeyword(c, lower))
        const total = filtered.length
        const sliceStart = (page - 1) * pageSize
        const sliceEnd = sliceStart + pageSize
        // 若缓存不足导致过滤结果为空，则继续走全量拉取避免“搜不到”
        if (total > 0) {
          return { list: filtered.slice(sliceStart, sliceEnd), total }
        }
      }

      const MAX_FETCH = 5000
      const PAGE_SIZE_FOR_FETCH = 500
      let fetched: XiaomanCompanyItem[] = []
      // 小满 start_index 按偏移量语义：0, 500, 1000...
      let startIndex = 0
      let totalItem: number | null = null
      let endedByMaxFetch = false
      let lastPageListLen = 0

      const fetchPageWithRetry = async (): Promise<{ list: XiaomanCompanyItem[]; totalItem?: number } | null> => {
        const url = `${baseUrl}/v1/company/list?count=${PAGE_SIZE_FOR_FETCH}&start_index=${page}${baseParams}`
        const maxAttempts = 3
        let lastError: unknown = null
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const text = await res.text()
            let json: {
              code?: number
              message?: string
              data?: { list?: XiaomanCompanyItem[]; totalItem?: number }
            }
            try {
              json = JSON.parse(text) as typeof json
            } catch {
              throw new Error(`小满 API 响应格式异常 (${res.status})`)
            }
            console.log('[xiaoman] json', json);
            if (json.code !== 200) {
              const msg = json.message || `小满客户列表获取失败 (code: ${json.code})`
              throw new Error(msg)
            }
            if (!json.data) {
              throw new Error('小满 API 返回数据为空，请确认账号权限与 API 范围')
            }
            return { list: json.data.list ?? [], totalItem: json.data.totalItem }
          } catch (e) {
            lastError = e
            const delayMs = 400 * attempt
            await new Promise((r) => setTimeout(r, delayMs))
          }
        }
        // 降级：这一页拿不到，就直接返回 null
        return null
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const r = await fetchPageWithRetry()
        if (!r) break

        if (totalItem == null && r.totalItem != null) {
          const parsed = Number(r.totalItem)
          if (Number.isFinite(parsed) && parsed > 0) totalItem = parsed
        }

        lastPageListLen = r.list.length
        fetched = fetched.concat(r.list)
        if (fetched.length >= MAX_FETCH) endedByMaxFetch = true

        const reachedTotal = totalItem != null ? fetched.length >= totalItem : false
        if (reachedTotal || fetched.length >= MAX_FETCH || r.list.length < PAGE_SIZE_FOR_FETCH) {
          break
        }
        startIndex += PAGE_SIZE_FOR_FETCH
      }

      // 只有在“看起来已拉完/自然结束”时才缓存，避免缓存不完整后导致后续永远搜不到
      const shouldCache = fetched.length > 0 && !endedByMaxFetch && (lastPageListLen < PAGE_SIZE_FOR_FETCH || (totalItem != null && fetched.length >= totalItem))
      if (shouldCache) {
        this.companyListCache = { list: fetched, fetchedAt: Date.now() }
      }

      if (!fetched.length) {
        return { list: [], total: 0 }
      }

      const lower = kw.toLowerCase()
      const filtered = fetched.filter((c) => this.matchesKeyword(c, lower))

      const total = filtered.length
      const sliceStart = (page - 1) * pageSize
      const sliceEnd = sliceStart + pageSize
      return { list: filtered.slice(sliceStart, sliceEnd), total }
    }

    // 无搜索关键词：按偏移量取一页
    const startIndex = Math.max(0, (page - 1) * pageSize);
    const url = `${baseUrl}/v1/company/list?count=${pageSize}&start_index=${page}${baseParams}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let json: {
      code?: number;
      message?: string;
      data?: { list?: XiaomanCompanyItem[]; totalItem?: number };
    };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new Error(`小满 API 响应格式异常 (${res.status})`);
    }
    if (json.code !== 200) {
      const msg = json.message || `小满客户列表获取失败 (code: ${json.code})`;
      throw new Error(msg);
    }
    if (!json.data) {
      throw new Error('小满 API 返回数据为空，请确认账号权限与 API 范围');
    }
    const list = json.data.list ?? [];
    const total = json.data.totalItem ?? list.length;
    return { list, total };
  }

  private detailLoggedOnce = false;

  async getCompanyDetail(companyId: number): Promise<XiaomanCompanyDetail | null> {
    const token = await this.getToken();
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/company/info?company_id=${companyId}&format=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let json: { code?: number; data?: XiaomanCompanyDetail };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      return null;
    }
    if (json.code !== 200 || !json.data) return null;
    // 只打印一次，用于确认联系人与合作日期的真实字段名
    if (!this.detailLoggedOnce) {
      this.detailLoggedOnce = true;
      // eslint-disable-next-line no-console
      console.log('[Xiaoman DEBUG] company detail raw:', JSON.stringify(json.data, null, 2));
    }
    return json.data;
  }

  /** 批量获取详情，每批 5 个并行，控制速度 */
  async getCompanyDetailsBatch(companyIds: number[]): Promise<(XiaomanCompanyDetail | null)[]> {
    const BATCH = 5;
    const results: (XiaomanCompanyDetail | null)[] = [];
    for (let i = 0; i < companyIds.length; i += BATCH) {
      const batch = companyIds.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map((id) => this.getCompanyDetail(id)));
      results.push(...batchResults);
    }
    return results;
  }
}
