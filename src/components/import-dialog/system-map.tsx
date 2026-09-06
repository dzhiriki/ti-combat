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
  /** The space area: who holds it, how many ships, and whether more than one
   *  player is up there — which is the case worth spotting, since it means a
   *  fight rather than a garrison. Null when nobody has ships here. */
  space: { faction: string; unitCount: number; contested: boolean } | null
  /** Ground forces below, summarised only as "how many planets hold units".
   *  Counts are left to the area list: a planet can hold dozens of infantry,
   *  and a three-digit number in a 56px hexagon reads as noise. */
  groundPlanets: number
  isActiveCombat: boolean
}

function summariseTiles(
  locations: readonly BattleLocation[],
): Map<string, TileSummary> {
  const byTile = new Map<string, TileSummary>()

  for (const location of locations) {
    const summary = byTile.get(location.tile) ?? {
      tile: location.tile,
      space: null,
      groundPlanets: 0,
      isActiveCombat: false,
    }
    if (location.mode === 'SPACE') {
      summary.space = {
        // `factions` is ordered strongest first.
        faction: location.factions[0],
        unitCount: location.unitCount,
        contested: location.factions.length > 1,
      }
    } else {
      summary.groundPlanets += 1
    }
    summary.isActiveCombat ||= !!location.isActiveCombat
    byTile.set(location.tile, summary)
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

  // Below this a hexagon stops being a comfortable tap target, so the map
  // scrolls sideways instead of shrinking any further. A three-ring six-player
  // board fits a phone with room to spare; the four-ring boards a seven- or
  // eight-player game uses still fit; only larger ones start to scroll.
  // Flat-top hexes are shorter than they are wide, so the width floor has to
  // clear the ~44px tap target with room for the 0.87 ratio.
  const minHexWidth = 52
  const minWidth = Math.round((layout.width * minHexWidth) / HEX_WIDTH)

  return (
    <div className={styles.viewport}>
      <div
        className={styles.map}
        style={{
          aspectRatio: `${layout.width} / ${layout.height}`,
          minWidth: `${minWidth}px`,
        }}
        role="group"
        aria-label="Systems"
      >
        {layout.cells.map(cell => {
          const summary = summaries.get(cell.position)
          const factionKey = summary?.space
            ? FACTION_BY_ASYNC_ID[summary.space.faction]
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
              >
                <span className={styles.face} />
              </span>
            )
          }

          const description = [
            summary.space
              ? `space held by ${factionLabel(summary.space.faction)}${
                  summary.space.contested ? ' (contested)' : ''
                }, ${summary.space.unitCount} ${
                  summary.space.unitCount === 1 ? 'unit' : 'units'
                }`
              : 'empty space',
            summary.groundPlanets > 0 &&
              `${summary.groundPlanets} planet${summary.groundPlanets > 1 ? 's' : ''}`,
          ]
            .filter(Boolean)
            .join('; ')

          return (
            <button
              key={cell.position}
              type="button"
              className={clsx(styles.hex, {
                [styles.hex_selected]: selected,
                [styles.hex_contested]: summary.space?.contested,
                [styles.hex_active]: summary.isActiveCombat,
              })}
              style={style}
              onClick={() => onSelectTile(cell.position)}
              aria-pressed={selected}
              title={`${cell.position} — ${description}`}
            >
              <span className={styles.face} aria-hidden="true" />
              {icon ? <FactionIcon icon={icon} /> : null}
              {summary.space ? (
                <span className={styles.count}>{summary.space.unitCount}</span>
              ) : null}
              {summary.groundPlanets > 0 ? (
                <span className={styles.ground} aria-hidden="true">
                  {'\u2022'.repeat(Math.min(summary.groundPlanets, 3))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
