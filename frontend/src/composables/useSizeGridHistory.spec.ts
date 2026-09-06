import { describe, expect, it } from 'vitest'
import { useSizeGridHistory } from './useSizeGridHistory'

describe('size grid operation history', () => {
  it('undoes whole paste including inserted rows, and redoes it', () => {
    let state = JSON.stringify([['胸围', '10']])
    const initial = state
    const history = useSizeGridHistory(() => state, snapshot => { state = snapshot })
    history.begin()
    state = JSON.stringify([['衣长', '20'], ['袖长', '30']])
    const pasted = state
    history.commit()
    history.undo(); expect(state).toBe(initial)
    history.redo(); expect(state).toBe(pasted)
  })
  it('commits pending typing before undo and discards redo after new edit', () => {
    let state = 'A'
    const history = useSizeGridHistory(() => state, snapshot => { state = snapshot })
    history.begin(); state = 'B'; history.undo()
    expect(state).toBe('A')
    history.begin(); state = 'C'; history.commit()
    expect(history.canRedo.value).toBe(false)
    history.undo(); expect(state).toBe('A')
  })
  it('ignores unchanged operations and clears on context change', () => {
    let state = 'A'
    const history = useSizeGridHistory(() => state, snapshot => { state = snapshot })
    history.begin(); history.commit(); expect(history.canUndo.value).toBe(false)
    history.begin(); state = 'B'; history.commit(); history.reset()
    history.undo(); expect(state).toBe('B')
  })
})
