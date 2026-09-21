import type { DiceGroup } from '@/types'

export function formatUnitStat(
  value: number | DiceGroup | null | undefined,
): string {
  if (value == null) return '—'
  if (Array.isArray(value)) {
    const [hit, dice, bonus = 0] = value
    return `${hit}${dice + bonus === 1 ? '' : ` × ${dice + bonus}`}`
  }
  return value === Infinity ? '∞' : String(value)
}
