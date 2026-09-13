import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import type { CombatOutcome, SurfaceSurvivors, SurvivorSide } from '@/combat'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { UNIT_SHORT_NAMES } from '@/constants/units'
import type { SurfaceDefinition, UnitBaseType } from '@/types'

import { sortSurvivors } from './sort-survivors'

import styles from './detailed-outcomes.module.css'

interface UnitPriority {
  attacker: string[]
  defender: string[]
}

interface DetailedOutcomesProps {
  outcomes: CombatOutcome[]
  unitPriority: UnitPriority
  participatingTypes: UnitPriority
  showSurfaces?: boolean
  surfaces?: readonly SurfaceDefinition[]
}

type DisplayMode = 'all' | 'participating'

const MODE_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'participating' as const, label: 'Participating' },
]

export function DetailedOutcomes({
  outcomes,
  unitPriority,
  participatingTypes,
  showSurfaces = false,
  surfaces = [],
}: DetailedOutcomesProps) {
  const [mode, setMode] = useState<DisplayMode>('all')

  const sorted = useMemo(() => {
    const filtered =
      mode === 'participating'
        ? outcomes.map(o => ({
            ...o,
            attacker: filterSide(o.attacker, participatingTypes.attacker),
            defender: filterSide(o.defender, participatingTypes.defender),
            attackerSurfaces: filterSurfaces(
              o.attackerSurfaces,
              participatingTypes.attacker,
            ),
            defenderSurfaces: filterSurfaces(
              o.defenderSurfaces,
              participatingTypes.defender,
            ),
          }))
        : outcomes
    return sortOutcomes(mergeOutcomes(filtered, showSurfaces))
  }, [outcomes, mode, participatingTypes, showSurfaces])

  return (
    <div className={styles.detailedPanel}>
      <div className={styles.modeRow}>
        <ToggleGroup<DisplayMode>
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
      </div>
      <table className={styles.detailedTable}>
        <thead>
          <tr className={styles.detailedHeader}>
            <th className={styles.detailedHeaderSide}>Attacker</th>
            <th className={styles.detailedHeaderProb}>%</th>
            <th className={styles.detailedHeaderSide}>Defender</th>
          </tr>
        </thead>
        <tbody className={styles.detailedList}>
          {sorted.map((outcome, i) => (
            <tr
              key={i}
              className={clsx(
                styles.outcomeRow,
                outcome.winner === 'attacker' && styles.outcomeRow_attacker,
                outcome.winner === 'defender' && styles.outcomeRow_defender,
                outcome.winner === 'draw' && styles.outcomeRow_draw,
              )}
            >
              <td className={styles.outcomeSide}>
                {showSurfaces ? (
                  <SurfaceSurvivorList
                    side={outcome.attackerSurfaces}
                    surfaces={surfaces}
                    priority={unitPriority.attacker}
                  />
                ) : (
                  <SurvivorList
                    side={outcome.attacker}
                    priority={unitPriority.attacker}
                  />
                )}
              </td>
              <td
                className={styles.outcomeProb}
                title={`${toFullDecimal(outcome.probability * 100)}%`}
              >
                {formatProbability(outcome.probability)}
              </td>
              <td
                className={clsx(styles.outcomeSide, styles.outcomeSide_right)}
              >
                {showSurfaces ? (
                  <SurfaceSurvivorList
                    side={outcome.defenderSurfaces}
                    surfaces={surfaces}
                    priority={unitPriority.defender}
                  />
                ) : (
                  <SurvivorList
                    side={outcome.defender}
                    priority={unitPriority.defender}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SurfaceSurvivorList({
  side,
  surfaces,
  priority,
}: {
  side: SurfaceSurvivors
  surfaces: readonly SurfaceDefinition[]
  priority: string[]
}) {
  return (
    <div>
      {surfaces.map(surface => (
        <div key={surface.id} className={styles.surfaceGroup}>
          <span className={styles.surfaceLabel}>{surface.name}</span>
          <span>
            <SurvivorList side={side[surface.id] ?? {}} priority={priority} />
          </span>
        </div>
      ))}
      {surfaces.length === 0 && <SurvivorList side={{}} priority={priority} />}
    </div>
  )
}

function SurvivorList({
  side,
  priority,
}: {
  side: SurvivorSide
  priority: string[]
}) {
  const entries = sortSurvivors(side, priority)
  if (entries.length === 0) {
    return <span className={styles.noSurvivors}>&mdash;</span>
  }

  const parts: string[] = []
  for (const entry of entries) {
    const name = UNIT_SHORT_NAMES[entry.base as UnitBaseType] ?? entry.base
    const label = entry.subtypes ? `${name}:${entry.subtypes.join(',')}` : name
    if (entry.healthy > 0) {
      parts.push(entry.healthy > 1 ? `${entry.healthy}${label}` : label)
    }
    if (entry.damaged > 0) {
      const dmgLabel = `${label}-`
      parts.push(entry.damaged > 1 ? `${entry.damaged}${dmgLabel}` : dmgLabel)
    }
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className={styles.unitEntry}>
          {i > 0 && <span className={styles.unitSeparator}>,&nbsp;</span>}
          {part}
        </span>
      ))}
    </>
  )
}

function filterSide(
  side: SurvivorSide,
  participating: readonly string[],
): SurvivorSide {
  if (participating.length === 0) return {}
  const allowed = new Set(participating)
  const result: SurvivorSide = {}
  for (const [base, units] of Object.entries(side)) {
    if (!units || !allowed.has(base)) continue
    result[base] = units
  }
  return result
}

function filterSurfaces(
  surfaces: SurfaceSurvivors,
  participating: readonly string[],
): SurfaceSurvivors {
  const result: SurfaceSurvivors = {}
  for (const [surfaceId, side] of Object.entries(surfaces)) {
    result[surfaceId] = filterSide(side, participating)
  }
  return result
}

/** Merge outcomes that show the same survivors on both sides (same winner,
 *  same per-variant healthy/damaged counts) — they only differ in internal
 *  ability resolution, which the table doesn't render. */
function mergeOutcomes(
  outcomes: CombatOutcome[],
  includeSurfaces: boolean,
): CombatOutcome[] {
  const merged = new Map<string, CombatOutcome>()
  for (const outcome of outcomes) {
    const surfaceKey = includeSurfaces
      ? `|${surfaceSignature(outcome.attackerSurfaces)}|${surfaceSignature(outcome.defenderSurfaces)}`
      : ''
    const key = `${outcome.winner}|${sideSignature(outcome.attacker)}|${sideSignature(outcome.defender)}${surfaceKey}`
    const existing = merged.get(key)
    if (existing) {
      existing.probability += outcome.probability
    } else {
      merged.set(key, { ...outcome })
    }
  }
  return [...merged.values()]
}

function surfaceSignature(surfaces: SurfaceSurvivors): string {
  return Object.entries(surfaces)
    .map(([surfaceId, side]) => `${surfaceId}=${sideSignature(side)}`)
    .sort()
    .join(';')
}

function sideSignature(side: SurvivorSide): string {
  const groups = new Map<string, { healthy: number; damaged: number }>()
  for (const [base, units] of Object.entries(side)) {
    if (!units) continue
    for (const u of units) {
      const variantKey = u.subtypes ? `${base}:${u.subtypes.join(',')}` : base
      const g = groups.get(variantKey) ?? { healthy: 0, damaged: 0 }
      if (u.isDamaged) g.damaged++
      else g.healthy++
      groups.set(variantKey, g)
    }
  }
  return [...groups.entries()]
    .map(([k, c]) => `${k}:${c.healthy}:${c.damaged}`)
    .sort()
    .join(',')
}

/** Sort outcomes from best to worst for attacker. Group by attacker
 *  composition first so similar attacker rows sit next to each other; break
 *  ties by defender. */
function sortOutcomes(outcomes: CombatOutcome[]): CombatOutcome[] {
  return [...outcomes].sort((a, b) => {
    const winOrder = { attacker: 0, draw: 1, defender: 2 }
    const winDiff = winOrder[a.winner] - winOrder[b.winner]
    if (winDiff !== 0) return winDiff

    const attackerCmp = compareSide(a.attacker, b.attacker, 'attacker')
    if (attackerCmp !== 0) return attackerCmp

    return compareSide(a.defender, b.defender, 'defender')
  })
}

/** Compare two sides; for `attacker` more units / fewer damaged is better,
 *  for `defender` fewer units / more damaged is better (from the attacker's
 *  POV). Falls back to a deterministic per-variant signature so identical
 *  totals with different compositions still sort consistently. */
function compareSide(
  a: SurvivorSide,
  b: SurvivorSide,
  role: 'attacker' | 'defender',
): number {
  const aTotal = countUnits(a)
  const bTotal = countUnits(b)
  if (aTotal !== bTotal) {
    return role === 'attacker' ? bTotal - aTotal : aTotal - bTotal
  }
  const aDmg = countDamaged(a)
  const bDmg = countDamaged(b)
  if (aDmg !== bDmg) {
    return role === 'attacker' ? aDmg - bDmg : bDmg - aDmg
  }
  const aSig = sideSignature(a)
  const bSig = sideSignature(b)
  return aSig < bSig ? -1 : aSig > bSig ? 1 : 0
}

function countUnits(side: SurvivorSide): number {
  return Object.values(side).reduce(
    (sum, units) => sum + (units?.length ?? 0),
    0,
  )
}

function countDamaged(side: SurvivorSide): number {
  return Object.values(side).reduce(
    (sum, units) => sum + (units?.filter(u => u.isDamaged).length ?? 0),
    0,
  )
}

function formatProbability(p: number): string {
  const pct = p * 100
  if (pct < 0.01) return '<0.01'
  if (pct >= 99.995) return '~100'
  return pct.toFixed(2)
}

/** Convert a number to full decimal string without scientific notation */
function toFullDecimal(n: number): string {
  if (n === 0) return '0'
  const s = n.toPrecision(8)
  if (!s.includes('e')) return s
  const [coeff, exp] = s.split('e')
  const e = Number(exp)
  const [int, frac = ''] = coeff.replace('-', '').split('.')
  const digits = int + frac
  const sign = n < 0 ? '-' : ''
  if (e >= 0) {
    const zeroes = Math.max(0, e + 1 - digits.length)
    return sign + digits + '0'.repeat(zeroes)
  }
  const pad = Math.max(0, -e - int.length)
  return sign + '0.' + '0'.repeat(pad) + digits
}
