/** 装箱单国家下拉：中英对照选择，存值与单据打印统一用英文国名（英文单据更规范）。
 *  小满订单带出的国家文本（多为 ISO 两位代码，如 US/NL/FR，也可能中/英全名）经 matchCountryEn 归一到这里的英文国名。 */
export interface CountryOption {
  /** ISO 3166-1 alpha-2 代码（小满订单国家多用此格式） */
  code: string
  cn: string
  en: string
}

/** 常用出口目的国（代码 + 中英对照）。需要可继续补充，存值取 en。 */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'US', cn: '美国', en: 'United States' },
  { code: 'CA', cn: '加拿大', en: 'Canada' },
  { code: 'MX', cn: '墨西哥', en: 'Mexico' },
  { code: 'GB', cn: '英国', en: 'United Kingdom' },
  { code: 'IE', cn: '爱尔兰', en: 'Ireland' },
  { code: 'FR', cn: '法国', en: 'France' },
  { code: 'DE', cn: '德国', en: 'Germany' },
  { code: 'IT', cn: '意大利', en: 'Italy' },
  { code: 'ES', cn: '西班牙', en: 'Spain' },
  { code: 'PT', cn: '葡萄牙', en: 'Portugal' },
  { code: 'NL', cn: '荷兰', en: 'Netherlands' },
  { code: 'BE', cn: '比利时', en: 'Belgium' },
  { code: 'LU', cn: '卢森堡', en: 'Luxembourg' },
  { code: 'CH', cn: '瑞士', en: 'Switzerland' },
  { code: 'AT', cn: '奥地利', en: 'Austria' },
  { code: 'SE', cn: '瑞典', en: 'Sweden' },
  { code: 'NO', cn: '挪威', en: 'Norway' },
  { code: 'DK', cn: '丹麦', en: 'Denmark' },
  { code: 'FI', cn: '芬兰', en: 'Finland' },
  { code: 'IS', cn: '冰岛', en: 'Iceland' },
  { code: 'PL', cn: '波兰', en: 'Poland' },
  { code: 'CZ', cn: '捷克', en: 'Czech Republic' },
  { code: 'SK', cn: '斯洛伐克', en: 'Slovakia' },
  { code: 'HU', cn: '匈牙利', en: 'Hungary' },
  { code: 'RO', cn: '罗马尼亚', en: 'Romania' },
  { code: 'BG', cn: '保加利亚', en: 'Bulgaria' },
  { code: 'GR', cn: '希腊', en: 'Greece' },
  { code: 'HR', cn: '克罗地亚', en: 'Croatia' },
  { code: 'SI', cn: '斯洛文尼亚', en: 'Slovenia' },
  { code: 'RS', cn: '塞尔维亚', en: 'Serbia' },
  { code: 'UA', cn: '乌克兰', en: 'Ukraine' },
  { code: 'RU', cn: '俄罗斯', en: 'Russia' },
  { code: 'TR', cn: '土耳其', en: 'Turkey' },
  { code: 'AU', cn: '澳大利亚', en: 'Australia' },
  { code: 'NZ', cn: '新西兰', en: 'New Zealand' },
  { code: 'JP', cn: '日本', en: 'Japan' },
  { code: 'KR', cn: '韩国', en: 'South Korea' },
  { code: 'CN', cn: '中国', en: 'China' },
  { code: 'HK', cn: '中国香港', en: 'Hong Kong' },
  { code: 'TW', cn: '中国台湾', en: 'Taiwan' },
  { code: 'SG', cn: '新加坡', en: 'Singapore' },
  { code: 'MY', cn: '马来西亚', en: 'Malaysia' },
  { code: 'TH', cn: '泰国', en: 'Thailand' },
  { code: 'VN', cn: '越南', en: 'Vietnam' },
  { code: 'ID', cn: '印度尼西亚', en: 'Indonesia' },
  { code: 'PH', cn: '菲律宾', en: 'Philippines' },
  { code: 'IN', cn: '印度', en: 'India' },
  { code: 'PK', cn: '巴基斯坦', en: 'Pakistan' },
  { code: 'BD', cn: '孟加拉国', en: 'Bangladesh' },
  { code: 'AE', cn: '阿联酋', en: 'United Arab Emirates' },
  { code: 'SA', cn: '沙特阿拉伯', en: 'Saudi Arabia' },
  { code: 'QA', cn: '卡塔尔', en: 'Qatar' },
  { code: 'KW', cn: '科威特', en: 'Kuwait' },
  { code: 'IL', cn: '以色列', en: 'Israel' },
  { code: 'ZA', cn: '南非', en: 'South Africa' },
  { code: 'EG', cn: '埃及', en: 'Egypt' },
  { code: 'MA', cn: '摩洛哥', en: 'Morocco' },
  { code: 'NG', cn: '尼日利亚', en: 'Nigeria' },
  { code: 'BR', cn: '巴西', en: 'Brazil' },
  { code: 'AR', cn: '阿根廷', en: 'Argentina' },
  { code: 'CL', cn: '智利', en: 'Chile' },
  { code: 'CO', cn: '哥伦比亚', en: 'Colombia' },
  { code: 'PE', cn: '秘鲁', en: 'Peru' },
]

/** 外部国家文本的常见别名/旧代码 → 英文国名 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  america: 'United States',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  uae: 'United Arab Emirates',
  korea: 'South Korea',
  'republic of korea': 'South Korea',
  '韩国': 'South Korea',
  '香港': 'Hong Kong',
  '台湾': 'Taiwan',
  '俄罗斯联邦': 'Russia',
}

/** 把外部国家文本（ISO 代码 / 中文 / 英文 / 别名）归一到下拉里的英文国名；匹配不到返回 ''（留空待手选） */
export function matchCountryEn(raw: string): string {
  const t = (raw || '').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  const alias = COUNTRY_ALIASES[lower] ?? COUNTRY_ALIASES[t]
  if (alias) return alias
  const hit = COUNTRY_OPTIONS.find(
    (c) =>
      c.code.toLowerCase() === lower ||
      c.en.toLowerCase() === lower ||
      c.cn === t ||
      c.cn.replace(/\s/g, '') === t.replace(/\s/g, ''),
  )
  return hit ? hit.en : ''
}
