import { clsx } from 'clsx'
import { useId, useMemo } from 'react'

import type { BattleLocation } from '@/async-ti4'
import { factionLabel } from '@/async-ti4'
import {
  COL_PITCH,
  HALF_ROW_PITCH,
  HEX_HEIGHT,
  HEX_WIDTH,
  layoutPositions,
} from '@/async-ti4/map-layout'
import { FACTION_BY_ASYNC_ID } from '@/async-ti4/mappings'
import factions from '@/data/faction'
import { namespaceSvgIds } from '@/utils/namespace-svg-ids'

import styles from './system-map.module.css'

interface SystemMapProps {
  /** Every tile position on the board, so the map keeps its shape rather than
   *  showing only the systems that happen to hold units. */
  positions: readonly string[]
  /** Every location in the game, as returned by `listBattleLocations`. */
  locations: readonly BattleLocation[]
  ringCount: number
  selectedTile: string | null
  onSelectTile: (tile: string) => void
}

interface TileSummary {
  tile: string
  /** Whoever holds the most here — the map shows one icon per system. */
  faction: string | null
  unitCount: number
  isActiveCombat: boolean
  contested: boolean
}

function summariseTiles(
  locations: readonly BattleLocation[],
): Map<string, TileSummary> {
  const byTile = new Map<string, TileSummary>()
  const strength = new Map<string, Map<string, number>>()

  for (const location of locations) {
    const existing = byTile.get(location.tile)
    byTile.set(location.tile, {
      tile: location.tile,
      faction: null,
      unitCount: (existing?.unitCount ?? 0) + location.unitCount,
      isActiveCombat: existing?.isActiveCombat || !!location.isActiveCombat,
      contested: existing?.contested || location.factions.length > 1,
    })

    // Weight by position in the list: `factions` is ordered strongest first,
    // which is enough to pick whose icon a system wears.
    const counts = strength.get(location.tile) ?? new Map<string, number>()
    location.factions.forEach((faction, index) => {
      counts.set(faction, (counts.get(faction) ?? 0) + (index === 0 ? 2 : 1))
    })
    strength.set(location.tile, counts)
  }

  for (const [tile, summary] of byTile) {
    const counts = [...(strength.get(tile) ?? new Map())].sort(
      (a, b) => b[1] - a[1],
    )
    summary.faction = counts[0]?.[0] ?? null
    // More than one faction anywhere in the system, space or ground.
    summary.contested = summary.contested || counts.length > 1
  }
  return byTile
}

function FactionIcon({ icon }: { icon: string }) {
  // Same per-instance namespacing the faction dropdown needs: these SVGs all
  // define clipPaths called `a`/`b`, and a map inlines forty at once.
  const id = useId()
  const html = useMemo(() => namespaceSvgIds(icon, id), [icon, id])
  return (
    <span className={styles.icon} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

/** The game's map, one hexagon per system, sized to whatever width it is given.
 *
 *  Positions come from AsyncTI4's ring numbering, so 6-player three-ring maps
 *  and the larger 7- and 8-player ones lay out the same way. Anything with no
 *  place on the grid is handed back to the caller rather than dropped. */
export function SystemMap({
  positions,
  locations,
  ringCount,
  selectedTile,
  onSelectTile,
}: SystemMapProps) {
  const summaries = useMemo(() => summariseTiles(locations), [locations])
  const layout = useMemo(
    () => layoutPositions(positions, ringCount),
    [positions, ringCount],
  )

  if (layout.cells.length === 0) return null

  return (
    <div
      className={styles.map}
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      role="group"
      aria-label="Systems"
    >
      {layout.cells.map(cell => {
        const summary = summaries.get(cell.position)
        const factionKey = summary?.faction
          ? FACTION_BY_ASYNC_ID[summary.faction]
          : undefined
        const icon = factionKey ? factions[factionKey].icon : undefined
        const selected = selectedTile === cell.position
        const style = {
          left: `${((cell.col - layout.minCol) * COL_PITCH * 100) / layout.width}%`,
          top: `${((cell.halfRow - layout.minHalfRow) * HALF_ROW_PITCH * 100) / layout.height}%`,
          width: `${(HEX_WIDTH * 100) / layout.width}%`,
          height: `${(HEX_HEIGHT * 100) / layout.height}%`,
        }

        // A system holding nothing this calculator models is drawn but not
        // offered: it keeps the board's shape without adding a dead tab stop.
        if (!summary) {
          return (
            <span
              key={cell.position}
              className={clsx(styles.hex, styles.hex_empty)}
              style={style}
              aria-hidden="true"
            />
          )
        }

        return (
          <button
            key={cell.position}
            type="button"
            className={clsx(styles.hex, {
              [styles.hex_selected]: selected,
              [styles.hex_contested]: summary.contested,
              [styles.hex_active]: summary.isActiveCombat,
            })}
            style={style}
            onClick={() => onSelectTile(cell.position)}
            aria-pressed={selected}
            title={
              summary.faction
                ? `${cell.position} — ${factionLabel(summary.faction)}, ${summary.unitCount} units`
                : cell.position
            }
          >
            {icon ? <FactionIcon icon={icon} /> : null}
            {summary.unitCount ? (
              <span className={styles.count}>{summary.unitCount}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
