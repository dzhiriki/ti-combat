import type { AbilitySlot } from '@/combat/abilities-engine/ability-slot'
import type { FactionAbilities, UnitBaseType } from '@/types'

export const FACTION_KEY_TO_SLOT = {
  faction: 'FACTION_ABILITY',
  technology: 'FACTION_TECHNOLOGY',
  unit: 'FACTION_UNIT',
  promissory: 'PROMISSORY',
  agent: 'AGENT',
  commander: 'COMMANDER',
  hero: 'FACTION_HERO',
  breakthrough: 'FACTION_BREAKTHROUGH',
} as const satisfies Record<keyof FactionAbilities, AbilitySlot>

export function unitSlot(baseType: UnitBaseType): AbilitySlot {
  if (baseType === 'FLAGSHIP') return 'FACTION_FLAGSHIP'
  if (baseType === 'MECH') return 'FACTION_MECH'
  return 'FACTION_UNIT'
}
