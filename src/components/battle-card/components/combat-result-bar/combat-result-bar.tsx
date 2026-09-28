import { clsx } from 'clsx'
import { useState } from 'react'

import type { CombatOutcome, CombatResult } from '@/combat'
import type { SurfaceDefinition } from '@/types'

import { DetailedOutcomes } from '../detailed-outcomes'

import styles from './combat-result-bar.module.css'

interface UnitPriority {
  attacker: string[]
  defender: string[]
}

interface CombatResultBarProps {
  /** Shown above the bar when there are several reports. */
  title?: string
  /** Label of the middle segment. */
  drawLabel?: string
  result: CombatResult | null
  /** Outcomes for the Detailed table; `undefined` hides the button. */
  outcomes: CombatOutcome[] | null | undefined
  unitPriority: UnitPriority
  participatingTypes: UnitPriority
  surfaces?: readonly SurfaceDefinition[]
  isComputing?: boolean
}

export function CombatResultBar({
  title,
  drawLabel = 'Draw',
  result,
  outcomes,
  unitPriority,
  participatingTypes,
  surfaces,
  isComputing,
}: CombatResultBarProps) {
  const [showDetailed, setShowDetailed] = useState(false)
  const segments = buildSegments(result, drawLabel)

  return (
    <div className={styles.wrapper}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <div className={clsx(styles.resultBar, isComputing && styles.loading)}>
        {segments.map(({ key, percent, percentRound, label, segmentClass }) => (
          <div
            key={key}
            className={clsx(styles.segment, segmentClass)}
            style={{ width: `${percent}%` }}
            title={`${percent.toFixed(3)}%`}
          >
            <span className={styles.segmentContent}>
              <span className={styles.percentage}>{percentRound}%</span>
              <span className={styles.label}>{label}</span>
            </span>
          </div>
        ))}
      </div>

      {outcomes !== undefined && (
        <button
          type="button"
          className={styles.detailedButton}
          disabled={!outcomes || outcomes.length === 0}
          onClick={() => setShowDetailed(v => !v)}
        >
          {showDetailed ? 'Hide' : 'Detailed'}
        </button>
      )}

      {showDetailed && outcomes && outcomes.length > 0 && (
        <DetailedOutcomes
          outcomes={outcomes}
          unitPriority={unitPriority}
          participatingTypes={participatingTypes}
          surfaces={surfaces}
        />
      )}
    </div>
  )
}

function roundToSum100(values: number[]): number[] {
  const floored = values.map(Math.floor)
  const remainders = values.map((v, i) => ({
    index: i,
    remainder: v - floored[i],
  }))
  let deficit = 100 - floored.reduce((a, b) => a + b, 0)

  remainders.sort((a, b) => b.remainder - a.remainder)
  for (const { index } of remainders) {
    if (deficit <= 0) break
    floored[index]++
    deficit--
  }

  return floored
}

function buildSegments(result: CombatResult | null, drawLabel: string) {
  const values = result || {
    attackerWin: 0,
    draw: 1,
    defenderWin: 0,
  }

  const [attackerPct, drawPct, defenderPct] = roundToSum100([
    values.attackerWin * 100,
    values.draw * 100,
    values.defenderWin * 100,
  ])

  return [
    {
      key: 'attacker',
      percentRound: attackerPct,
      percent: values.attackerWin * 100,
      label: 'Attacker',
      segmentClass: 'theme-attacker',
    },
    {
      key: 'draw',
      percentRound: drawPct,
      percent: values.draw * 100,
      label: drawLabel,
    },
    {
      key: 'defender',
      percentRound: defenderPct,
      percent: values.defenderWin * 100,
      label: 'Defender',
      segmentClass: 'theme-defender',
    },
  ]
}
