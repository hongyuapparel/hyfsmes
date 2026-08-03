import { describe, expect, it } from 'vitest'
import {
  normalizeOrderQuoteReturnTo,
  parseOrderQuoteQueueQuery,
  serializeOrderQuoteQueueQuery,
} from './order-quote-queue'

describe('order quote queue helpers', () => {
  it('keeps supported filters and strips paging or unrelated flags', () => {
    const encoded = serializeOrderQuoteQueueQuery({
      customer: ' 鸿宇 ',
      merchandiser: 'Kiki',
      orderTypeId: 5,
      status: 'completed',
      page: 3,
      pageSize: 100,
      unquoted: true,
      deletedOnly: true,
    })

    expect(parseOrderQuoteQueueQuery(encoded)).toEqual({
      customer: '鸿宇',
      merchandiser: 'Kiki',
      status: 'completed',
      orderTypeId: 5,
    })
  })

  it('returns an empty query for malformed route input', () => {
    expect(parseOrderQuoteQueueQuery('{broken')).toEqual({})
    expect(parseOrderQuoteQueueQuery(['{}'])).toEqual({})
  })

  it('only accepts order-list return paths', () => {
    expect(normalizeOrderQuoteReturnTo('/orders/list?unquoted=1')).toBe('/orders/list?unquoted=1')
    expect(normalizeOrderQuoteReturnTo('/settings/users')).toBe('/orders/list?unquoted=1')
  })
})
