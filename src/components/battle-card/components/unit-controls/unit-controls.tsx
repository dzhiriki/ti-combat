import { ArrowUpIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import { ButtonIcon } from '@/components/ui/button-icon'
import { Input } from '@/components/ui/input'

import styles from './unit-controls.module.css'

interface UnitControlsProps {
  count: number
  upgraded: boolean
  hasUpgrade: boolean
  limit: number
  flipped?: boolean
  disabled?: boolean
  onCountChange: (count: number) => void
  onUpgradeToggle: () => void
  className?: string
}

export function UnitControls({
  count,
  upgraded,
  hasUpgrade,
  limit,
  flipped,
  disabled,
  onCountChange,
  onUpgradeToggle,
  className,
}: UnitControlsProps) {
  const atLimit = count >= limit

  return (
    <div
      className={clsx(
        styles.controls,
        flipped && styles.controls_flipped,
        className,
      )}
    >
      <div className={styles.upgrade}>
        {hasUpgrade && (
          <ButtonIcon
            className={clsx(
              styles.upgradeButton,
              upgraded && styles.upgradeButton_active,
            )}
            onClick={onUpgradeToggle}
            disabled={disabled}
            title={upgraded ? 'Upgraded' : 'Click to upgrade'}
          >
            <ArrowUpIcon className={styles.upgradeIcon} />
          </ButtonIcon>
        )}
      </div>
      <ButtonIcon
        onClick={() => onCountChange(Math.max(0, count - 1))}
        disabled={disabled || count === 0}
        tabIndex={-1}
      >
        <MinusIcon />
      </ButtonIcon>

      <div className={clsx('theme-reset', styles.input)}>
        <Input
          value={count}
          min={0}
          max={limit}
          onChange={onCountChange}
          steppers={false}
          disabled={disabled}
        />
      </div>

      <ButtonIcon
        onClick={() => onCountChange(count + 1)}
        disabled={disabled || atLimit}
        tabIndex={-1}
      >
        <PlusIcon />
      </ButtonIcon>
    </div>
  )
}
