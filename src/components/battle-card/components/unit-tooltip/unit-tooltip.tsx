import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import type { CombatSide } from '@/types'
import { formatUnitStat } from '@/utils/format-unit-stat'
import type { UnitTooltipData } from '@/utils/get-unit-tooltips'

import styles from './unit-tooltip.module.css'

interface UnitTooltipProps {
  name: string
  data: UnitTooltipData
  side: CombatSide
}

function UnitCard({ data, side }: { data: UnitTooltipData; side: CombatSide }) {
  const { stats } = data
  const abilities = stats.UNIT_ABILITIES
  const unitAbilities = [
    abilities?.SUSTAIN_DAMAGE && 'Sustain Damage',
    abilities?.PLANETARY_SHIELD && 'Planetary Shield',
    abilities?.AFB && `Anti-Fighter Barrage ${formatUnitStat(abilities.AFB)}`,
    abilities?.BOMBARDMENT &&
      `Bombardment ${formatUnitStat(abilities.BOMBARDMENT)}`,
    abilities?.SPACE_CANNON &&
      `Space Cannon ${formatUnitStat(abilities.SPACE_CANNON)}`,
    abilities?.PRODUCTION != null &&
      `Production ${formatUnitStat(abilities.PRODUCTION)}`,
    abilities?.DEPLOY && !abilities.DEPLOY.description && 'Deploy',
  ].filter(Boolean)

  return (
    <section
      className={clsx(styles.card, `theme-${side}`)}
      aria-label={`${side === 'attacker' ? 'Attacker' : 'Defender'}: ${data.name}`}
    >
      <header>
        <h3 className={styles.name}>{data.name}</h3>
      </header>
      <dl className={styles.stats}>
        {(['COST', 'COMBAT', 'MOVE', 'CAPACITY'] as const).map(key => (
          <div className={styles.stat} key={key}>
            <dt>{key}</dt>
            <dd>{formatUnitStat(stats[key])}</dd>
          </div>
        ))}
      </dl>
      {data.textAbilities.length > 0 && (
        <div className={styles.section}>
          {data.textAbilities.map((ability, index) => (
            <p key={index}>{ability.description}</p>
          ))}
        </div>
      )}
      {unitAbilities.length > 0 && (
        <div className={styles.section}>
          <ul>
            {unitAbilities.map(ability => (
              <li key={String(ability)}>{ability}</li>
            ))}
          </ul>
        </div>
      )}
      {data.copiedAbilities.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.heading}>Copied abilities</h4>
          {data.copiedAbilities.map(ability => (
            <div className={styles.copiedAbility} key={ability.name}>
              <h5>{ability.name}</h5>
              {ability.description && <p>{ability.description}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function UnitTooltip({ name, data, side }: UnitTooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const pointerType = useRef('')
  const wasOpen = useRef(false)
  const [isOpen, setIsOpen] = useState(false)

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), [])

  const position = useCallback(() => {
    const popover = popoverRef.current
    const trigger = triggerRef.current
    if (!popover?.matches(':popover-open') || !trigger) return
    const margin = 8
    const gap = 8
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = window.innerHeight
    const anchor = trigger.getBoundingClientRect()
    const rect = popover.getBoundingClientRect()
    // Measure the unconstrained content without expanding the scroll container:
    // expanding it while scrolling would clamp scrollTop and prevent reaching the end.
    const contentHeight =
      (popover.firstElementChild?.getBoundingClientRect().height ?? 0) + 2
    const above = Math.max(0, anchor.top - gap - margin)
    const below = Math.max(0, viewportHeight - anchor.bottom - gap - margin)
    const placeAbove =
      contentHeight <= above || (contentHeight > below && above >= below)
    const height = Math.min(contentHeight, placeAbove ? above : below)
    popover.style.maxHeight = `${height}px`
    popover.style.left = `${Math.max(margin, Math.min(anchor.left + anchor.width / 2 - rect.width / 2, viewportWidth - rect.width - margin))}px`
    popover.style.top = `${Math.max(margin, Math.min(placeAbove ? anchor.top - gap - height : anchor.bottom + gap, viewportHeight - height - margin))}px`
  }, [])

  const show = () => {
    cancelClose()
    popoverRef.current?.showPopover()
    position()
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      const active = document.activeElement
      if (
        active &&
        (popoverRef.current?.contains(active) ||
          (active === triggerRef.current && active.matches(':focus-visible')))
      )
        return
      popoverRef.current?.hidePopover()
    }, 150)
  }

  useEffect(() => cancelClose, [cancelClose])

  useLayoutEffect(() => {
    if (!isOpen) return
    position()
    const observer = new ResizeObserver(position)
    if (triggerRef.current) observer.observe(triggerRef.current)
    window.addEventListener('resize', position)
    // Nested containers can scroll independently of the document.
    window.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [isOpen, data, position])

  return (
    <div
      className={clsx(styles.wrapper, `theme-${side}`)}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') show()
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'touch') scheduleClose()
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`${side === 'attacker' ? 'Attacker' : 'Defender'} ${name} details`}
        aria-describedby={isOpen ? id : undefined}
        onFocus={event => {
          if (event.currentTarget.matches(':focus-visible')) show()
        }}
        onPointerDown={event => {
          pointerType.current = event.pointerType
          wasOpen.current =
            popoverRef.current?.matches(':popover-open') ?? false
        }}
        onClick={event => {
          if (
            pointerType.current === 'touch' &&
            event.detail !== 0 &&
            wasOpen.current
          ) {
            popoverRef.current?.hidePopover()
          } else {
            show()
          }
        }}
      >
        <QuestionMarkCircledIcon aria-hidden="true" />
      </button>
      <div
        ref={popoverRef}
        id={id}
        role="tooltip"
        popover="auto"
        tabIndex={0}
        className={styles.popover}
        onToggle={event => setIsOpen(event.newState === 'open')}
        onPointerEnter={cancelClose}
        onFocus={cancelClose}
      >
        <UnitCard data={data} side={side} />
      </div>
    </div>
  )
}
