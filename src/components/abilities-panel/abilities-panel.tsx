import { filter, groupBy, pipe } from 'remeda'

import type {
  AbilityReadContext,
  CombatMode,
  RegisteredAbility,
} from '@/combat'
import { extractDefaults } from '@/combat'
import type { GameSystem, SlotDisplay } from '@/types'
import { getGameData } from '@/utils/get-game-data'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

export type AbilityFilterMode = 'all' | 'same' | 'enabled'

interface AbilitiesPanelProps {
  system: GameSystem
  abilities: RegisteredAbility[]
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
  searchQuery?: string
  filterMode: AbilityFilterMode
}

function hasUI(reg: RegisteredAbility): boolean {
  const a = reg.ability
  return !!a.headerUI || (a.uiConfig?.length ?? 0) > 0
}

function isAbilityEnabled(
  reg: RegisteredAbility,
  params: Record<string, unknown> | undefined,
): boolean {
  const merged = { ...extractDefaults(reg.ability), ...params }
  const isEnabled = merged.isEnabled
  const uses = merged.uses
  return isEnabled === true && (typeof uses !== 'number' || uses > 0)
}

function isInCurrentMode(
  reg: RegisteredAbility,
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

type SlotDisplayMap = Readonly<Record<string, SlotDisplay>>

function displayOf(
  reg: RegisteredAbility,
  slotDisplay: SlotDisplayMap,
): SlotDisplay {
  const display = slotDisplay[reg.slot]
  if (!display) throw new Error(`Missing display config for slot "${reg.slot}"`)
  return display
}

// Per-entry sub-header wins over the slot's own (TF unit upgrades group by
// unit type, so every card in the slot carries its own).
function subcategoryOf(
  reg: RegisteredAbility,
  slotDisplay: SlotDisplayMap,
): string | undefined {
  return reg.subcategory ?? displayOf(reg, slotDisplay).subcategory
}

function matchesSearch(
  reg: RegisteredAbility,
  query: string,
  slotDisplay: SlotDisplayMap,
): boolean {
  const haystack = [
    reg.ability.name,
    reg.ability.description ?? '',
    displayOf(reg, slotDisplay).category,
    subcategoryOf(reg, slotDisplay) ?? '',
  ]
    .join(' ')
    .toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)
  return tokens.every(token => fuzzyMatch(haystack, token))
}

function slotIndex(slot: string, slotOrder: readonly string[]): number {
  const i = slotOrder.indexOf(slot)
  return i === -1 ? Infinity : i
}

function firstSlotIndex(
  regs: RegisteredAbility[] | undefined,
  slotOrder: readonly string[],
): number {
  return Math.min(...(regs ?? []).map(reg => slotIndex(reg.slot, slotOrder)))
}

// Slots where the faction icon would just repeat what the FACTION header
// already says (own faction's agents/commanders surfaced under FACTION).
const HIDE_ICON_SLOTS: ReadonlySet<string> = new Set([
  'FACTION_AGENT',
  'FACTION_COMMANDER',
])

function renderAbilityConfig(
  reg: RegisteredAbility,
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
      hideIcon={HIDE_ICON_SLOTS.has(reg.slot)}
    />
  )
}

export function AbilitiesPanel({
  system,
  abilities,
  readContext,
  combatMode,
  params,
  onParamsChange,
  searchQuery,
  filterMode,
}: AbilitiesPanelProps): React.ReactElement {
  const { SLOT_DISPLAY: slotDisplay, SLOT_ORDER: slotOrder } =
    getGameData(system)
  const normalizedQuery = searchQuery?.trim().toLowerCase() ?? ''
  const visible = pipe(
    abilities,
    filter(hasUI),
    filter(
      reg =>
        !normalizedQuery || matchesSearch(reg, normalizedQuery, slotDisplay),
    ),
    filter(reg => {
      if (filterMode === 'all') return true
      if (filterMode === 'same') return isInCurrentMode(reg, combatMode)
      return isAbilityEnabled(reg, params[reg.ability.key])
    }),
  )

  const byCategory = groupBy(
    visible,
    reg => displayOf(reg, slotDisplay).category,
  )

  const orderedCategories = Object.keys(byCategory).sort((a, b) => {
    const minA = Math.min(
      ...byCategory[a]!.map(r => slotIndex(r.slot, slotOrder)),
    )
    const minB = Math.min(
      ...byCategory[b]!.map(r => slotIndex(r.slot, slotOrder)),
    )
    return minA - minB
  })

  return (
    <div className={styles.container}>
      {orderedCategories.map(category => {
        const entries = byCategory[category] ?? []

        if (
          entries.some(reg => subcategoryOf(reg, slotDisplay) !== undefined)
        ) {
          const bySubcategory = groupBy(
            entries,
            reg => subcategoryOf(reg, slotDisplay) ?? 'ABILITY',
          )
          // SLOT_ORDER governs cross-slot sub-headers (FACTION); within one
          // slot the sort is stable, so groups keep registration order — which
          // for the TF unit-upgrade deck is the UI's unit ordering.
          const subcategories = Object.keys(bySubcategory).sort(
            (a, b) =>
              firstSlotIndex(bySubcategory[a], slotOrder) -
              firstSlotIndex(bySubcategory[b], slotOrder),
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
