import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { SplitSlider } from '@/components/ui/split-slider'

import styles from './unit-split.module.css'

interface SplitItem {
  label: string
  value: string
  surfaceName?: string
}

export type UnitSplitValue = [string, number][]

/** The unit types with more than one place to split them between. */
export function splitGroups(items: readonly SplitItem[]): SplitItem[][] {
  const byType = Map.groupBy(
    items,
    item => parseUnitLocator(item.value).unitType,
  )
  return [...byType.values()].filter(group => group.length > 1)
}

interface UnitSplitProps {
  items: readonly SplitItem[]
  value: UnitSplitValue
  onChange: (value: UnitSplitValue) => void
}

export function UnitSplit({ items, value, onChange }: UnitSplitProps) {
  const counts = new Map(value)

  const change = (group: readonly SplitItem[], values: readonly number[]) => {
    const next = new Map(values.map((count, i) => [group[i].value, count]))
    const updated = value.map(([key, count]): [string, number] => [
      key,
      next.get(key) ?? count,
    ])
    for (const [key, count] of next)
      if (!counts.has(key)) updated.push([key, count])
    onChange(updated)
  }

  return (
    <div className={styles.list}>
      {splitGroups(items).map(group => {
        const segments = group.map(item => ({
          label: item.surfaceName ?? item.value,
          value: counts.get(item.value) ?? 0,
        }))
        const total = segments.reduce((sum, segment) => sum + segment.value, 0)
        return (
          <div key={group[0].value} className={styles.item}>
            <span className={styles.label}>
              {group[0].label}
              <span className={styles.total}>{total}</span>
            </span>
            <SplitSlider
              label={group[0].label}
              segments={segments}
              onChange={values => change(group, values)}
            />
          </div>
        )
      })}
    </div>
  )
}
