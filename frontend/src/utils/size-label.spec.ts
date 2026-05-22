import { describe, expect, it } from 'vitest'
import { nextSizeLabel } from './size-label'

describe('nextSizeLabel', () => {
  it('字母码梯：S/M/L/XL 接续为 2XL', () => {
    expect(nextSizeLabel(['S', 'M', 'L', 'XL'])).toBe('2XL')
  })

  it('字母码梯：2XL 接续为 3XL', () => {
    expect(nextSizeLabel(['S', 'M', 'L', 'XL', '2XL'])).toBe('3XL')
  })

  it('字母码梯：基础档逐级递进', () => {
    expect(nextSizeLabel(['XS'])).toBe('S')
    expect(nextSizeLabel(['S'])).toBe('M')
    expect(nextSizeLabel(['M'])).toBe('L')
    expect(nextSizeLabel(['L'])).toBe('XL')
    expect(nextSizeLabel(['XL'])).toBe('2XL')
  })

  it('NXL 模式：4XL 接续为 5XL', () => {
    expect(nextSizeLabel(['XL', '2XL', '3XL', '4XL'])).toBe('5XL')
  })

  it('大小写不敏感：小写字母码也能接续', () => {
    expect(nextSizeLabel(['s', 'm', 'l', 'xl'])).toBe('2XL')
  })

  it('XXL/XXXL 别名按 2XL/3XL 写法接续', () => {
    expect(nextSizeLabel(['L', 'XXL'])).toBe('3XL')
    expect(nextSizeLabel(['XXXL'])).toBe('4XL')
  })

  it('数字码：按步长接续（4,6,8 → 10）', () => {
    expect(nextSizeLabel(['4', '6', '8'])).toBe('10')
  })

  it('数字码：步长为 2 的另一组（10,12 → 14）', () => {
    expect(nextSizeLabel(['10', '12'])).toBe('14')
  })

  it('单个数字无法判断步长，回退为「尺码N」', () => {
    expect(nextSizeLabel(['8'])).toBe('尺码2')
  })

  it('无法识别的自定义命名，回退为「尺码N」', () => {
    expect(nextSizeLabel(['尺码1', '尺码2'])).toBe('尺码3')
    expect(nextSizeLabel(['M', '均码'])).toBe('尺码3')
  })

  it('空列表回退为「尺码1」', () => {
    expect(nextSizeLabel([])).toBe('尺码1')
  })
})
