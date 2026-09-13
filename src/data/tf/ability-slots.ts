import type { SlotDisplay, UnitBaseType } from '@/types'

export type AbilitySlot =
  | 'GENERAL'
  | 'ADVANCED'
  | 'RELIC'
  | 'ENVIRONMENT'
  | 'FACTION_FLAGSHIP'
  | 'FACTION_MECH'
  | 'FACTION_UNIT'
  | 'TF_ABILITY'
  | 'TF_GENOME'
  | 'TF_PARADIGM'
  | 'TF_ACTION_CARD'
  | 'TF_UNIT_UPGRADE'

// Twilight's Fall factions do not have faction-owned ability decks. Their
// configurable faction abilities come from flagship and mech unit text.
export const FACTION_KEY_TO_SLOT = {} as const satisfies Record<
  string,
  AbilitySlot
>

export function unitSlot(baseType: UnitBaseType): AbilitySlot {
  if (baseType === 'FLAGSHIP') return 'FACTION_FLAGSHIP'
  if (baseType === 'MECH') return 'FACTION_MECH'
  return 'FACTION_UNIT'
}

export const SLOT_DISPLAY = {
  GENERAL: { category: 'GENERAL' },
  ADVANCED: { category: 'ADVANCED' },
  RELIC: { category: 'RELIC' },
  ENVIRONMENT: { category: 'ENVIRONMENT' },
  FACTION_FLAGSHIP: { category: 'FACTION', subcategory: 'FLAGSHIP' },
  FACTION_MECH: { category: 'FACTION', subcategory: 'MECH' },
  FACTION_UNIT: { category: 'FACTION', subcategory: 'UNIT' },
  TF_ABILITY: { category: 'ABILITY' },
  TF_GENOME: { category: 'GENOME' },
  TF_PARADIGM: { category: 'PARADIGM' },
  TF_ACTION_CARD: { category: 'ACTION CARD' },
  TF_UNIT_UPGRADE: { category: 'UNIT UPGRADE' },
} satisfies Record<AbilitySlot, SlotDisplay>

/** Render order for top-level groups and FACTION subgroups. */
export const SLOT_ORDER = [
  'GENERAL',
  'TF_ABILITY',
  'TF_GENOME',
  'TF_PARADIGM',
  'TF_ACTION_CARD',
  'TF_UNIT_UPGRADE',
  'FACTION_FLAGSHIP',
  'FACTION_MECH',
  'FACTION_UNIT',
  'RELIC',
  'ENVIRONMENT',
  'ADVANCED',
] as const satisfies readonly AbilitySlot[]
