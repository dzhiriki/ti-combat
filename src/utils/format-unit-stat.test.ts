import { expect, it } from 'vitest'

import { formatUnitStat } from './format-unit-stat'

it('formats absent values, zeroes, fractional costs and dice counts', () => {
  expect(formatUnitStat(undefined)).toBe('—')
  expect(formatUnitStat(null)).toBe('—')
  expect(formatUnitStat(0)).toBe('0')
  expect(formatUnitStat(0.5)).toBe('0.5')
  expect(formatUnitStat(Infinity)).toBe('∞')
  expect(formatUnitStat([5, 1])).toBe('5')
  expect(formatUnitStat([5, 2])).toBe('5 × 2')
  expect(formatUnitStat([5, 2, 1])).toBe('5 × 3')
})
