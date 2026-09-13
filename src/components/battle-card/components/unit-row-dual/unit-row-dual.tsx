import { UnitControls } from '../unit-controls'

import styles from './unit-row-dual.module.css'

interface UnitRowDualProps {
  name: string
  limit: number
  attackerLimit?: number
  defenderLimit?: number
  attackerDisabled?: boolean
  defenderDisabled?: boolean
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
  limit,
  attackerLimit,
  defenderLimit,
  attackerDisabled,
  defenderDisabled,
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
        limit={attackerLimit ?? limit}
        disabled={attackerDisabled}
        onCountChange={onAttackerCountChange}
        onUpgradeToggle={onAttackerUpgradeToggle}
        className="theme-attacker"
      />
      <span className={styles.unit}>
        <span className={styles.unitName}>{name}</span>
      </span>
      <UnitControls
        count={defender.count}
        upgraded={defender.upgraded}
        hasUpgrade={defenderHasUpgrade}
        limit={defenderLimit ?? limit}
        disabled={defenderDisabled}
        flipped
        onCountChange={onDefenderCountChange}
        onUpgradeToggle={onDefenderUpgradeToggle}
        className="theme-defender"
      />
    </div>
  )
}
