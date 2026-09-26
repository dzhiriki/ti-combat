import { UnitControls, type UnitControlsProps } from '../unit-controls'

import styles from './unit-row-dual.module.css'

export type SideUnitControls = Omit<UnitControlsProps, 'flipped' | 'className'>

interface UnitRowDualProps {
  name: string
  attacker: SideUnitControls
  defender: SideUnitControls
}

export function UnitRowDual({ name, attacker, defender }: UnitRowDualProps) {
  return (
    <div className={styles.row}>
      <UnitControls {...attacker} className="theme-attacker" />
      <span className={styles.unit}>
        <span className={styles.unitName}>{name}</span>
      </span>
      <UnitControls {...defender} flipped className="theme-defender" />
    </div>
  )
}
