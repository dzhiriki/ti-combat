import { clsx } from 'clsx'
import { useId, useMemo } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import factions from '@/data/faction'
import type { Faction, FactionKey, GameSystem } from '@/types'
import { GAME_SYSTEMS, getFactionSystem } from '@/utils/get-faction-system'
import { namespaceSvgIds } from '@/utils/namespace-svg-ids'

import styles from './faction-select.module.css'

const ALL_FACTION_ENTRIES = (
  Object.entries(factions) as Array<[string, Faction]>
).sort((a, b) => {
  if (a[0] === 'NEUTRAL') return 1
  if (b[0] === 'NEUTRAL') return -1
  return a[1].name.localeCompare(b[1].name)
})

// Precompute the dropdown entries for each system so the list can be filtered
// to the active mode without re-sorting on every render. Neutral has base-game
// stats and is offered in every system, so it lands in all buckets.
const FACTION_ENTRIES_BY_SYSTEM = ALL_FACTION_ENTRIES.reduce(
  (acc, entry) => {
    const systems =
      entry[0] === 'NEUTRAL'
        ? GAME_SYSTEMS
        : [getFactionSystem(entry[0] as FactionKey)]
    for (const system of systems) (acc[system] ??= []).push(entry)
    return acc
  },
  {} as Record<GameSystem, Array<[string, Faction]>>,
)

function FactionIcon({ icon }: { icon: string }) {
  // Namespace internal SVG ids per instance — the faction SVGs all define
  // clipPaths named `a`/`b`/..., and an open dropdown inlines many at once.
  const id = useId()
  const html = useMemo(() => namespaceSvgIds(icon, id), [icon, id])
  return (
    <span className={styles.icon} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

interface FactionSelectProps {
  value: FactionKey
  system: GameSystem
  onValueChange: (value: FactionKey) => void
  className?: string
  align?: 'start' | 'center' | 'end'
}

export function FactionSelect({
  value,
  system,
  onValueChange,
  className,
  align,
}: FactionSelectProps) {
  const entries = FACTION_ENTRIES_BY_SYSTEM[system] ?? []
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={clsx(styles.trigger, className)}>
        <SelectValue placeholder="Select faction" />
      </SelectTrigger>
      <SelectContent className={clsx(styles.content, className)} align={align}>
        {entries.map(([key, faction]) => (
          <SelectItem key={key} value={key} className={styles.item}>
            <span className={styles.itemContent}>
              {faction.icon ? (
                <FactionIcon icon={faction.icon} />
              ) : (
                <span className={styles.iconIndent} />
              )}
              <span className={styles.itemName}>{faction.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
