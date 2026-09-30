import { describe, expect, it } from 'vitest'

import { keepHiddenEntries } from './keep-hidden-entries'

describe('keepHiddenEntries', () => {
  it('reorders visible entries around hidden ones', () => {
    const result = keepHiddenEntries(
      [
        ['a', true],
        ['hidden', false],
        ['b', true],
        ['c', false],
      ],
      [
        ['c', false],
        ['a', true],
        ['b', true],
      ],
    )
    expect(result).toEqual([
      ['c', false],
      ['hidden', false],
      ['a', true],
      ['b', true],
    ])
  })

  it('appends visible entries missing from the stored value', () => {
    const result = keepHiddenEntries([['hidden'], ['a']], [['b'], ['a']])
    expect(result).toEqual([['hidden'], ['b'], ['a']])
  })
})
