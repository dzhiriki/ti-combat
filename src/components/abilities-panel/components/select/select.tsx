import {
  Select as SelectRoot,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  groupUnitOptions,
  labelUnitOptions,
  type SurfaceOption,
} from '../unit-option-presentation'

import styles from './select.module.css'

export type SelectOption = SurfaceOption

export interface SelectOptionGroup {
  group: string
  items: readonly SelectOption[]
}

interface SelectProps {
  items: readonly (SelectOption | SelectOptionGroup)[]
  value: string
  onChange: (value: string) => void
}

export function Select({
  items,
  value,
  onChange,
}: SelectProps): React.ReactElement {
  const hasSurfaces = items.some(
    item => !('group' in item) && item.surfaceId !== undefined,
  )
  const flat = items.flatMap(item =>
    'group' in item ? [...item.items] : [item],
  )
  const presented = hasSurfaces
    ? groupUnitOptions(flat).flatMap<SelectOption | SelectOptionGroup>(group =>
        group.label
          ? [{ group: group.label, items: group.items }]
          : group.items,
      )
    : items
  const selected = hasSurfaces
    ? labelUnitOptions(flat).find(item => item.value === value)?.label
    : undefined
  return (
    <SelectRoot value={value} onValueChange={onChange}>
      <SelectTrigger className={styles.trigger}>
        <SelectValue>{selected}</SelectValue>
      </SelectTrigger>
      <SelectContent className={styles.content}>
        {presented.map(item =>
          'group' in item ? (
            <SelectGroup key={item.group}>
              <SelectLabel className={styles.label}>{item.group}</SelectLabel>
              {item.items.map(gi => (
                <SelectItem
                  key={gi.value}
                  value={gi.value}
                  className={styles.item}
                >
                  {gi.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectItem
              key={item.value}
              value={item.value}
              className={styles.item}
            >
              {item.label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </SelectRoot>
  )
}
