import {
  ChevronDownIcon,
  ChevronRightIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons'
import clsx from 'clsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  extractDefaults,
} from '@/combat'
import type { UIConfigItem } from '@/combat/abilities-engine/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { namespaceSvgIds } from '@/utils/namespace-svg-ids'

import {
  type CheckboxListValue,
  List,
  type NumberListValue,
  type OrderListValue,
} from '../list'
import { Select } from '../select'
import styles from './ability-config.module.css'

interface AbilityConfigProps {
  ability: Ability
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, unknown>
  onParamsChange: (params: Record<string, unknown>) => void
  hideIcon?: boolean
}

export function AbilityConfig({
  ability,
  readContext,
  combatMode,
  params,
  onParamsChange,
  hideIcon,
}: AbilityConfigProps): React.ReactElement {
  const id = useId()
  const anchorName = `--a${id.replaceAll(':', '')}`
  // Namespace the icon's internal SVG ids per instance — the faction SVGs all
  // define clipPaths named `a`/`b`/..., and inlining many at once makes them
  // resolve against each other's shapes.
  const iconHtml = useMemo(
    () => (ability.icon ? namespaceSvgIds(ability.icon, id) : undefined),
    [ability.icon, id],
  )
  const defaults = useMemo(() => extractDefaults(ability), [ability])
  const headerUiRef = useRef<HTMLInputElement>(null)

  const uiConfigItems = useMemo((): UIConfigItem[] | undefined => {
    let items: UIConfigItem[] | undefined
    if (typeof ability.uiConfig !== 'function') {
      items = ability.uiConfig
    } else {
      const effectiveParams = { ...defaults, ...params }
      // Set the running ability on the shared context so `ctx.this` and any
      // SideApi lookups (e.g. `getUnitVariantsOptions(paramKey)`) resolve to
      // this ability's spec. uiConfig is synchronous, so the surrounding
      // try/finally restores the previous value before any other rendering.
      const ctx = readContext as AbilityReadContext & { ability?: Ability }
      const prev = ctx.ability
      ctx.ability = ability
      try {
        items = ability.uiConfig(ctx, effectiveParams)
      } finally {
        ctx.ability = prev
      }
    }
    return items?.filter(
      item =>
        item.visible !== false &&
        (item.type !== 'unit-list' || item.items.length > 0),
    )
  }, [ability, defaults, readContext, params])

  useEffect(() => {
    if (!uiConfigItems) return
    for (const config of uiConfigItems) {
      if (config.type !== 'unit-list') continue
      const key = config.key as string
      const allowed = new Set(config.items.map(i => i.value))
      const value = params[key] ?? config.defaultValue ?? defaults?.[key] ?? []
      if (!Array.isArray(value)) continue
      for (const entry of value) {
        const unitType = Array.isArray(entry) ? entry[0] : entry
        if (typeof unitType !== 'string') continue
        if (!allowed.has(unitType)) {
          console.warn('[ability params] extra value', {
            abilityKey: ability.key,
            paramKey: key,
            value: unitType,
          })
        }
      }
    }
  }, [ability.key, uiConfigItems, params, defaults])

  const hasConfigItems = uiConfigItems && uiConfigItems.length > 0
  const isCollapsible = !!hasConfigItems
  const [isCollapsed, setIsCollapsed] = useState(true)

  function handleCheckboxChange(key: string, checked: boolean): void {
    onParamsChange({ ...params, [key]: checked })
  }

  function handleListChange(key: string, list: unknown): void {
    onParamsChange({ ...params, [key]: list })
  }

  function handleNumberChange(key: string, value: number): void {
    onParamsChange({ ...params, [key]: value })
  }

  function handleSelectChange(key: string, value: string): void {
    onParamsChange({ ...params, [key]: value })
  }

  function toggleCollapsed(): void {
    setIsCollapsed(prev => !prev)
  }

  const hasTooltip = !!ability.description || !!ability.warning
  const tooltipContent = hasTooltip ? (
    <>
      {ability.description && (
        <p className={styles.tooltipParagraph}>{ability.description}</p>
      )}
      {ability.warning && (
        <p className={clsx(styles.tooltipParagraph, styles.tooltipWarning)}>
          {ability.warning}
        </p>
      )}
    </>
  ) : null
  const descriptionIcon = hasTooltip ? (
    <Tooltip content={tooltipContent} anchor={anchorName}>
      <QuestionMarkCircledIcon className={styles.descriptionIcon} />
    </Tooltip>
  ) : null

  const headerParamKey = ability.headerUI
  const headerParamValue = headerParamKey
    ? (params[headerParamKey] ?? defaults?.[headerParamKey])
    : undefined
  const headerParamType = typeof headerParamValue as 'boolean' | 'number'

  function handleContainerClick(e: React.MouseEvent): void {
    if (ability.readOnly || !headerParamKey) {
      toggleCollapsed()
      return
    }

    if (headerParamType === 'boolean') {
      e.stopPropagation()
      handleCheckboxChange(headerParamKey, !params[headerParamKey])
    }

    if (headerParamType === 'number') {
      e.stopPropagation()
      headerUiRef.current?.focus()
    }
  }

  function handleCollapseClick(e: React.MouseEvent): void {
    e.stopPropagation()
    toggleCollapsed()
  }

  const headerControl =
    !!headerParamKey &&
    {
      boolean: (
        <Checkbox
          checked={!!params[headerParamKey]}
          disabled={ability.readOnly}
          className={styles.headerCheckbox}
          onChange={checked => handleCheckboxChange(headerParamKey, checked)}
          onClick={event => event.stopPropagation()}
          ref={headerUiRef}
        />
      ),
      number: (
        <Input
          square
          value={
            (params[headerParamKey] ??
              defaults?.[headerParamKey] ??
              0) as number
          }
          min={0}
          disabled={ability.readOnly}
          onChange={value => handleNumberChange(headerParamKey, value)}
          onClick={e => e.stopPropagation()}
          ref={headerUiRef}
          active={!!params[headerParamKey]}
        />
      ),
    }[headerParamType]

  const header = (
    <div className={styles.header} onClick={handleContainerClick}>
      {isCollapsible ? (
        <button
          type="button"
          className={styles.collapseButton}
          onClick={handleCollapseClick}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </button>
      ) : (
        <span className={styles.collapseIndent} />
      )}
      {iconHtml && !hideIcon && (
        <span
          className={styles.icon}
          dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
      )}
      <span className={styles.title}>{ability.name}</span>
      {descriptionIcon}
      {headerControl}
    </div>
  )

  return (
    <div
      className={clsx({
        [styles.container]: true,
        [styles.container_clickable]: headerParamKey || isCollapsible,
        [styles.container_readOnly]: ability.readOnly,
        [styles.container_active]: !!headerParamValue,
        [styles.container_dimmed]:
          ability.context && ability.context !== combatMode,
      })}
      style={hasTooltip ? ({ anchorName } as React.CSSProperties) : undefined}
    >
      {header}
      {hasConfigItems && !isCollapsed && (
        <div className={styles.configItems} onClick={e => e.stopPropagation()}>
          {uiConfigItems!.map(config => {
            const key = config.key as string
            const defaultValue = config.defaultValue ?? defaults?.[key]

            if (config.type === 'checkbox') {
              const value = params[key] ?? defaultValue ?? false
              return (
                <label key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <Checkbox
                    checked={!!value}
                    onChange={checked => handleCheckboxChange(key, checked)}
                  />
                </label>
              )
            }

            if (config.type === 'number') {
              const value = (params[key] ?? defaultValue ?? 0) as number
              return (
                <label key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <Input
                    value={value}
                    min={config.min}
                    max={config.max}
                    onChange={v => handleNumberChange(key, v)}
                  />
                </label>
              )
            }

            if (config.type === 'select') {
              const value = (params[key] ?? defaultValue ?? '') as string
              return (
                <div key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <Select
                    items={config.items}
                    value={value}
                    onChange={v => handleSelectChange(key, v)}
                  />
                </div>
              )
            }

            if (config.type === 'unit-list') {
              const rawValue = (params[key] ?? defaultValue ?? []) as unknown
              return (
                <div key={key} className={styles.configItemGroup}>
                  {config.label && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  {config.mode === 'order' ? (
                    <List
                      mode="order"
                      sortable={config.sortable}
                      items={config.items}
                      value={rawValue as OrderListValue}
                      onChange={value => handleListChange(key, value)}
                    />
                  ) : config.mode === 'checkbox' ? (
                    <List
                      mode="checkbox"
                      sortable={config.sortable}
                      items={config.items}
                      value={rawValue as CheckboxListValue}
                      onChange={value => handleListChange(key, value)}
                    />
                  ) : (
                    <List
                      mode="number"
                      sortable={config.sortable}
                      items={config.items}
                      value={rawValue as NumberListValue}
                      onChange={value => handleListChange(key, value)}
                    />
                  )}
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
