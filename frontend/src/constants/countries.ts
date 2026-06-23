/** 装箱单国家下拉：中英对照选择，存值与单据打印统一用英文国名（英文单据更规范）。
 *  小满订单带出的国家文本（可能中/英/缩写）经 matchCountryEn 归一到这里的英文国名。 */
export interface CountryOption {
  cn: string
  en: string
}

/** 常用出口目的国（中英对照）。需要可继续补充，存值取 en。 */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { cn: '美国', en: 'United States' },
  { cn: '加拿大', en: 'Canada' },
  { cn: '墨西哥', en: 'Mexico' },
  { cn: '英国', en: 'United Kingdom' },
  { cn: '爱尔兰', en: 'Ireland' },
  { cn: '法国', en: 'France' },
  { cn: '德国', en: 'Germany' },
  { cn: '意大利', en: 'Italy' },
  { cn: '西班牙', en: 'Spain' },
  { cn: '葡萄牙', en: 'Portugal' },
  { cn: '荷兰', en: 'Netherlands' },
  { cn: '比利时', en: 'Belgium' },
  { cn: '卢森堡', en: 'Luxembourg' },
  { cn: '瑞士', en: 'Switzerland' },
  { cn: '奥地利', en: 'Austria' },
  { cn: '瑞典', en: 'Sweden' },
  { cn: '挪威', en: 'Norway' },
  { cn: '丹麦', en: 'Denmark' },
  { cn: '芬兰', en: 'Finland' },
  { cn: '冰岛', en: 'Iceland' },
  { cn: '波兰', en: 'Poland' },
  { cn: '捷克', en: 'Czech Republic' },
  { cn: '斯洛伐克', en: 'Slovakia' },
  { cn: '匈牙利', en: 'Hungary' },
  { cn: '罗马尼亚', en: 'Romania' },
  { cn: '保加利亚', en: 'Bulgaria' },
  { cn: '希腊', en: 'Greece' },
  { cn: '克罗地亚', en: 'Croatia' },
  { cn: '斯洛文尼亚', en: 'Slovenia' },
  { cn: '塞尔维亚', en: 'Serbia' },
  { cn: '乌克兰', en: 'Ukraine' },
  { cn: '俄罗斯', en: 'Russia' },
  { cn: '土耳其', en: 'Turkey' },
  { cn: '澳大利亚', en: 'Australia' },
  { cn: '新西兰', en: 'New Zealand' },
  { cn: '日本', en: 'Japan' },
  { cn: '韩国', en: 'South Korea' },
  { cn: '中国', en: 'China' },
  { cn: '中国香港', en: 'Hong Kong' },
  { cn: '中国台湾', en: 'Taiwan' },
  { cn: '新加坡', en: 'Singapore' },
  { cn: '马来西亚', en: 'Malaysia' },
  { cn: '泰国', en: 'Thailand' },
  { cn: '越南', en: 'Vietnam' },
  { cn: '印度尼西亚', en: 'Indonesia' },
  { cn: '菲律宾', en: 'Philippines' },
  { cn: '印度', en: 'India' },
  { cn: '巴基斯坦', en: 'Pakistan' },
  { cn: '孟加拉国', en: 'Bangladesh' },
  { cn: '阿联酋', en: 'United Arab Emirates' },
  { cn: '沙特阿拉伯', en: 'Saudi Arabia' },
  { cn: '卡塔尔', en: 'Qatar' },
  { cn: '科威特', en: 'Kuwait' },
  { cn: '以色列', en: 'Israel' },
  { cn: '南非', en: 'South Africa' },
  { cn: '埃及', en: 'Egypt' },
  { cn: '摩洛哥', en: 'Morocco' },
  { cn: '尼日利亚', en: 'Nigeria' },
  { cn: '巴西', en: 'Brazil' },
  { cn: '阿根廷', en: 'Argentina' },
  { cn: '智利', en: 'Chile' },
  { cn: '哥伦比亚', en: 'Colombia' },
  { cn: '秘鲁', en: 'Peru' },
]

/** 小满/外部国家文本的常见别名 → 英文国名 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  america: 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
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

/** 把外部国家文本（中/英/缩写）归一到下拉里的英文国名；匹配不到返回 ''（留空待手选） */
export function matchCountryEn(raw: string): string {
  const t = (raw || '').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  const alias = COUNTRY_ALIASES[lower] ?? COUNTRY_ALIASES[t]
  if (alias) return alias
  const hit = COUNTRY_OPTIONS.find(
    (c) => c.en.toLowerCase() === lower || c.cn === t || c.cn.replace(/\s/g, '') === t.replace(/\s/g, ''),
  )
  return hit ? hit.en : ''
}
