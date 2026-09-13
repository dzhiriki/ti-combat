import type { SlotDisplay, UnitBaseType } from '@/types'

export type AbilitySlot =
  | 'GENERAL'
  | 'ADVANCED'
  | 'TECHNOLOGY'
  | 'ACTION_CARD'
  | 'RELIC'
  | 'AGENDA'
  | 'ENVIRONMENT'
  | 'FACTION_ABILITY'
  | 'FACTION_TECHNOLOGY'
  | 'FACTION_AGENT'
  | 'FACTION_COMMANDER'
  | 'FACTION_HERO'
  | 'FACTION_BREAKTHROUGH'
  | 'PROMISSORY'
  | 'AGENT'
  | 'COMMANDER'
  | 'FACTION_FLAGSHIP'
  | 'FACTION_MECH'
  | 'FACTION_UNIT'
  | 'OTHER'

export const FACTION_KEY_TO_SLOT = {
  faction: 'FACTION_ABILITY',
  technology: 'FACTION_TECHNOLOGY',
  unit: 'FACTION_UNIT',
  promissory: 'PROMISSORY',
  agent: 'AGENT',
  commander: 'COMMANDER',
  hero: 'FACTION_HERO',
  breakthrough: 'FACTION_BREAKTHROUGH',
} as const satisfies Record<string, AbilitySlot>

export function unitSlot(baseType: UnitBaseType): AbilitySlot {
  if (baseType === 'FLAGSHIP') return 'FACTION_FLAGSHIP'
  if (baseType === 'MECH') return 'FACTION_MECH'
  return 'FACTION_UNIT'
}

export const SLOT_DISPLAY = {
  GENERAL: { category: 'GENERAL' },
  ADVANCED: { category: 'ADVANCED' },
  TECHNOLOGY: { category: 'TECHNOLOGY' },
  ACTION_CARD: { category: 'ACTION CARD' },
  RELIC: { category: 'RELIC' },
  AGENDA: { category: 'AGENDA' },
  ENVIRONMENT: { category: 'ENVIRONMENT' },
  PROMISSORY: { category: 'PROMISSORY' },
  AGENT: { category: 'AGENT' },
  COMMANDER: { category: 'COMMANDER' },
  FACTION_ABILITY: { category: 'FACTION', subcategory: 'ABILITY' },
  FACTION_TECHNOLOGY: { category: 'FACTION', subcategory: 'TECHNOLOGY' },
  FACTION_AGENT: { category: 'FACTION', subcategory: 'AGENT' },
  FACTION_COMMANDER: { category: 'FACTION', subcategory: 'COMMANDER' },
  FACTION_HERO: { category: 'FACTION', subcategory: 'HERO' },
  FACTION_BREAKTHROUGH: { category: 'FACTION', subcategory: 'BREAKTHROUGH' },
  FACTION_FLAGSHIP: { category: 'FACTION', subcategory: 'FLAGSHIP' },
  FACTION_MECH: { category: 'FACTION', subcategory: 'MECH' },
  FACTION_UNIT: { category: 'FACTION', subcategory: 'UNIT' },
  OTHER: { category: 'OTHER' },
} satisfies Record<AbilitySlot, SlotDisplay>

/** Render order for top-level groups and FACTION subgroups. */
export const SLOT_ORDER = [
  'GENERAL',
  'FACTION_ABILITY',
  'FACTION_FLAGSHIP',
  'FACTION_AGENT',
  'FACTION_COMMANDER',
  'FACTION_HERO',
  'FACTION_MECH',
  'FACTION_BREAKTHROUGH',
  'FACTION_TECHNOLOGY',
  'FACTION_UNIT',
  'TECHNOLOGY',
  'ACTION_CARD',
  'PROMISSORY',
  'AGENT',
  'COMMANDER',
  'RELIC',
  'AGENDA',
  'ENVIRONMENT',
  'OTHER',
  'ADVANCED',
] as const satisfies readonly AbilitySlot[]
