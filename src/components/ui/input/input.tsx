import { MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { forwardRef, useId } from 'react'

import { ButtonIcon } from '@/components/ui/button-icon'

import styles from './input.module.css'

interface InputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  square?: boolean
  active?: boolean
  disabled?: boolean
  steppers?: boolean
  /** Shown as an empty field with the placeholder; clearing the field
   *  selects it. */
  emptyValue?: number
  placeholder?: string
  onClick?: React.MouseEventHandler<HTMLInputElement>
  onPointerDown?: React.PointerEventHandler<HTMLInputElement>
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    onChange,
    min,
    max,
    step = 1,
    square,
    active,
    disabled,
    steppers = true,
    emptyValue,
    placeholder,
    onClick,
    onPointerDown,
  },
  ref,
): React.ReactElement {
  const reactId = useId()
  const anchorName = `--input-anchor-${reactId.replaceAll(':', '')}`

  const lower = min ?? 0
  const upper = max ?? Infinity

  function clamp(n: number): number {
    return Math.min(upper, Math.max(lower, n))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.valueAsNumber
    if (isNaN(raw) && emptyValue !== undefined) {
      onChange(emptyValue)
      return
    }
    const parsed = isNaN(raw) ? 0 : Math.trunc(raw)
    onChange(clamp(parsed))
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>): void {
    e.target.select()
  }

  if (!steppers) {
    return (
      <input
        ref={ref}
        type="number"
        className={clsx(styles.input, {
          [styles.input_square]: square,
          [styles.input_active]: active,
        })}
        value={value === emptyValue ? '' : value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onClick={onClick}
        onPointerDown={onPointerDown}
      />
    )
  }

  const inputEl = (
    <input
      ref={ref}
      type="number"
      className={clsx(styles.input, {
        [styles.input_square]: square,
        [styles.input_active]: active,
      })}
      value={value === emptyValue ? '' : value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={handleChange}
      onFocus={handleFocus}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{ anchorName } as React.CSSProperties}
    />
  )

  const downDisabled = disabled || value <= lower
  const upDisabled = disabled || value >= upper

  function handleStep(delta: number, e: React.MouseEvent): void {
    e.stopPropagation()
    onChange(clamp(value + delta))
  }

  function preventBlur(e: React.MouseEvent): void {
    e.preventDefault()
  }

  const stepStyle = { positionAnchor: anchorName } as React.CSSProperties

  return (
    <span className={styles.wrapper}>
      <ButtonIcon
        tabIndex={-1}
        aria-label="Decrease"
        className={clsx(styles.step, styles.stepDown)}
        disabled={downDisabled}
        onMouseDown={preventBlur}
        onClick={e => handleStep(-step, e)}
        style={stepStyle}
      >
        <MinusIcon />
      </ButtonIcon>
      {inputEl}
      <ButtonIcon
        tabIndex={-1}
        aria-label="Increase"
        className={clsx(styles.step, styles.stepUp)}
        disabled={upDisabled}
        onMouseDown={preventBlur}
        onClick={e => handleStep(step, e)}
        style={stepStyle}
      >
        <PlusIcon />
      </ButtonIcon>
    </span>
  )
})
