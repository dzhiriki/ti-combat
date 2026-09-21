import type { UnitTooltipData } from '@/utils/get-unit-tooltips'

import { UnitControls } from '../unit-controls'
import { UnitTooltip } from '../unit-tooltip'

import styles from './unit-row-dual.module.css'

interface UnitRowDualProps {
  name: string
  attackerTooltip: UnitTooltipData
  defenderTooltip: UnitTooltipData
  limit: number
  attackerHasUpgrade: boolean
  defenderHasUpgrade: boolean
  attacker: { count: number; upgraded: boolean }
  defender: { count: number; upgraded: boolean }
  onAttackerCountChange: (count: number) => void
  onAttackerUpgradeToggle: () => void
  onDefenderCountChange: (count: number) => void
  onDefenderUpgradeToggle: () => void
}

export function UnitRowDual({
  name,
  attackerTooltip,
  defenderTooltip,
  limit,
  attackerHasUpgrade,
  defenderHasUpgrade,
  attacker,
  defender,
  onAttackerCountChange,
  onAttackerUpgradeToggle,
  onDefenderCountChange,
  onDefenderUpgradeToggle,
}: UnitRowDualProps) {
  return (
    <div className={styles.row}>
      <UnitControls
        count={attacker.count}
        upgraded={attacker.upgraded}
        hasUpgrade={attackerHasUpgrade}
        limit={limit}
        onCountChange={onAttackerCountChange}
        onUpgradeToggle={onAttackerUpgradeToggle}
        className="theme-attacker"
      />
      <div className={styles.unit}>
        <UnitTooltip name={name} data={attackerTooltip} side="attacker" />
        <span className={styles.unitName}>{name}</span>
        <UnitTooltip name={name} data={defenderTooltip} side="defender" />
      </div>
      <UnitControls
        count={defender.count}
        upgraded={defender.upgraded}
        hasUpgrade={defenderHasUpgrade}
        limit={limit}
        flipped
        onCountChange={onDefenderCountChange}
        onUpgradeToggle={onDefenderUpgradeToggle}
        className="theme-defender"
      />
    </div>
  )
}
