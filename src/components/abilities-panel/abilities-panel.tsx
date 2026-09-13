import { filter, pipe } from 'remeda'

import type { AbilityReadContext, CombatMode } from '@/combat'
import { extractDefaults } from '@/combat'
import type {
  CollectedAbility,
  SlotCategory,
  SlotConfig,
  SlotEntry,
} from '@/types'
import { matchesAbilitySlot } from '@/utils/matches-ability-slot'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

export type AbilityFilterMode = 'all' | 'same' | 'enabled'

interface AbilitiesPanelProps {
  abilities: CollectedAbility[]
  slots: readonly SlotEntry[]
  factionKey: string
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
  searchQuery?: string
  filterMode: AbilityFilterMode
}

function hasUI(reg: CollectedAbility): boolean {
  return !!reg.headerUI || (reg.uiConfig?.length ?? 0) > 0
}

function isAbilityEnabled(
  reg: CollectedAbility,
  params: Record<string, unknown> | undefined,
): boolean {
  const merged = { ...extractDefaults(reg), ...params }
  const isEnabled = merged.isEnabled
  const uses = merged.uses
  return isEnabled === true && (typeof uses !== 'number' || uses > 0)
}

function isInCurrentMode(
  reg: CollectedAbility,
  combatMode: CombatMode,
): boolean {
  return !reg.context || reg.context === combatMode
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

function matchesSearch(
  reg: CollectedAbility,
  query: string,
  titles: string,
): boolean {
  const haystack = [reg.name, reg.description ?? '', titles]
    .join(' ')
    .toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)
  return tokens.every(token => fuzzyMatch(haystack, token))
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
  hideIcon: boolean,
): React.ReactElement {
  return (
    <AbilityConfig
      key={reg.key}
      ability={reg}
      readContext={readContext}
      combatMode={combatMode}
      params={params[reg.key] ?? {}}
      onParamsChange={newParams => onParamsChange(reg.key, newParams)}
      hideIcon={hideIcon}
    />
  )
}

export function AbilitiesPanel({
  abilities,
  slots,
  factionKey,
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
    filter(reg => {
      if (filterMode === 'all') return true
      if (filterMode === 'same') return isInCurrentMode(reg, combatMode)
      return isAbilityEnabled(reg, params[reg.key])
    }),
  )

  const renderGroup = (config: SlotConfig, category?: SlotCategory) => {
    const entries = visible.filter(
      reg =>
        matchesAbilitySlot(reg, config, factionKey, category?.neutral) &&
        (!normalizedQuery ||
          matchesSearch(
            reg,
            normalizedQuery,
            `${category?.title ?? ''} ${config.title}`,
          )),
    )
    if (entries.length === 0) return null
    return (
      <div key={config.title}>
        {category && (
          <div className={styles.subcategoryLabel}>{config.title}</div>
        )}
        <div className={styles.abilitiesList}>
          {entries.map(reg =>
            renderAbilityConfig(
              reg,
              readContext,
              combatMode,
              params,
              onParamsChange,
              !(config.icon ?? category?.icon ?? true),
            ),
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {slots.map(entry => {
        const groups =
          'items' in entry
            ? entry.items
                .map(item => renderGroup(item, entry))
                .filter(group => group !== null)
            : [renderGroup(entry)].filter(group => group !== null)
        if (groups.length === 0) return null
        return (
          <div key={entry.title}>
            <h6 className={styles.categoryLabel}>{entry.title}</h6>
            {groups}
          </div>
        )
      })}
    </div>
  )
}
