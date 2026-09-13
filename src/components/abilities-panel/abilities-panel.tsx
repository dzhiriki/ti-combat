import { filter, groupBy, pipe } from 'remeda'

import type { AbilityReadContext, CombatMode } from '@/combat'
import { extractDefaults } from '@/combat'
import type { CollectedAbility } from '@/types'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

export type AbilityFilterMode = 'all' | 'same' | 'enabled'

interface AbilitiesPanelProps {
  abilities: CollectedAbility[]
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
  searchQuery?: string
  filterMode: AbilityFilterMode
}

function hasUI(reg: CollectedAbility): boolean {
  const a = reg.ability
  return !!a.headerUI || (a.uiConfig?.length ?? 0) > 0
}

function isAbilityEnabled(
  reg: CollectedAbility,
  params: Record<string, unknown> | undefined,
): boolean {
  const merged = { ...extractDefaults(reg.ability), ...params }
  const isEnabled = merged.isEnabled
  const uses = merged.uses
  return isEnabled === true && (typeof uses !== 'number' || uses > 0)
}

function isInCurrentMode(
  reg: CollectedAbility,
  combatMode: CombatMode,
): boolean {
  return !reg.ability.context || reg.ability.context === combatMode
}

function isSubsequence(word: string, needle: string): boolean {
  let i = 0
  for (let w = 0; w < word.length && i < needle.length; w++) {
    if (word[w] === needle[i]) i++
  }
  return i === needle.length
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true
  for (const word of haystack.split(/\s+/)) {
    if (word && isSubsequence(word, needle)) return true
  }
  return false
}

function matchesSearch(reg: CollectedAbility, query: string): boolean {
  const haystack = [
    reg.ability.name,
    reg.ability.description ?? '',
    reg.display.category,
    reg.display.subcategory ?? '',
  ]
    .join(' ')
    .toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)
  return tokens.every(token => fuzzyMatch(haystack, token))
}

function firstSlotOrder(regs: CollectedAbility[] | undefined): number {
  return Math.min(...(regs ?? []).map(reg => reg.display.order))
}

function renderAbilityConfig(
  reg: CollectedAbility,
  readContext: AbilityReadContext,
  combatMode: CombatMode,
  params: Record<string, Record<string, unknown>>,
  onParamsChange: (
    abilityName: string,
    params: Record<string, unknown>,
  ) => void,
): React.ReactElement {
  const ability = reg.ability
  return (
    <AbilityConfig
      key={ability.key}
      ability={ability}
      readContext={readContext}
      combatMode={combatMode}
      params={params[ability.key] ?? {}}
      onParamsChange={newParams => onParamsChange(ability.key, newParams)}
      hideIcon={!reg.display.icon}
    />
  )
}

export function AbilitiesPanel({
  abilities,
  readContext,
  combatMode,
  params,
  onParamsChange,
  searchQuery,
  filterMode,
}: AbilitiesPanelProps): React.ReactElement {
  const normalizedQuery = searchQuery?.trim().toLowerCase() ?? ''
  const visible = pipe(
    abilities,
    filter(hasUI),
    filter(reg => !normalizedQuery || matchesSearch(reg, normalizedQuery)),
    filter(reg => {
      if (filterMode === 'all') return true
      if (filterMode === 'same') return isInCurrentMode(reg, combatMode)
      return isAbilityEnabled(reg, params[reg.ability.key])
    }),
  )

  const byCategory = groupBy(visible, reg => reg.display.category)

  const orderedCategories = Object.keys(byCategory).sort(
    (a, b) => firstSlotOrder(byCategory[a]) - firstSlotOrder(byCategory[b]),
  )

  return (
    <div className={styles.container}>
      {orderedCategories.map(category => {
        const entries = byCategory[category] ?? []

        if (entries.some(reg => reg.display.subcategory !== undefined)) {
          const bySubcategory = groupBy(
            entries,
            reg => reg.display.subcategory ?? 'ABILITY',
          )
          // Slot config order governs sub-headers; within one the sort is
          // stable, so cards keep registration order.
          const subcategories = Object.keys(bySubcategory).sort(
            (a, b) =>
              firstSlotOrder(bySubcategory[a]) -
              firstSlotOrder(bySubcategory[b]),
          )

          return (
            <div key={category}>
              <h6 className={styles.categoryLabel}>{category}</h6>
              {subcategories.map(subcategory => (
                <div key={subcategory}>
                  <div className={styles.subcategoryLabel}>{subcategory}</div>
                  <div className={styles.abilitiesList}>
                    {bySubcategory[subcategory]?.map(reg =>
                      renderAbilityConfig(
                        reg,
                        readContext,
                        combatMode,
                        params,
                        onParamsChange,
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }

        return (
          <div key={category}>
            <h6 className={styles.categoryLabel}>{category}</h6>
            <div className={styles.abilitiesList}>
              {entries.map(reg =>
                renderAbilityConfig(
                  reg,
                  readContext,
                  combatMode,
                  params,
                  onParamsChange,
                ),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
