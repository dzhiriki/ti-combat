import type { SlotEntry, SlotNames } from '@/types'

/**
 * The system's ability layout in render order. Twilight's Fall factions have
 * no faction-owned ability decks, so the only `OWN` slots are the unit ones:
 * their configurable faction abilities come from flagship and mech unit text.
 */
export const SLOTS = [
  { title: 'GENERAL', slot: 'GENERAL' },
  {
    title: 'FACTION',
    items: [
      { title: 'FLAGSHIP', slot: 'FACTION_FLAGSHIP', strategy: 'OWN' },
      { title: 'MECH', slot: 'FACTION_MECH', strategy: 'OWN' },
    ],
  },
  // Neutral only holds what anyone might have handed it: genomes.
  { title: 'ABILITY', slot: 'TF_ABILITY', neutral: false },
  { title: 'GENOME', slot: 'TF_GENOME' },
  { title: 'PARADIGM', slot: 'TF_PARADIGM', neutral: false },
  { title: 'ACTION CARD', slot: 'TF_ACTION_CARD', neutral: false },
  // One slot per unit type, in the UI's unit order, so the deck renders
  // grouped by the unit each card upgrades.
  {
    title: 'UNIT UPGRADE',
    neutral: false,
    items: [
      { title: 'Flagship', slot: 'TF_UNIT_UPGRADE_FLAGSHIP' },
      { title: 'War Sun', slot: 'TF_UNIT_UPGRADE_WAR_SUN' },
      { title: 'Dreadnought', slot: 'TF_UNIT_UPGRADE_DREADNOUGHT' },
      { title: 'Carrier', slot: 'TF_UNIT_UPGRADE_CARRIER' },
      { title: 'Cruiser', slot: 'TF_UNIT_UPGRADE_CRUISER' },
      { title: 'Destroyer', slot: 'TF_UNIT_UPGRADE_DESTROYER' },
      { title: 'Fighter', slot: 'TF_UNIT_UPGRADE_FIGHTER' },
      { title: 'Mech', slot: 'TF_UNIT_UPGRADE_MECH' },
      { title: 'Infantry', slot: 'TF_UNIT_UPGRADE_INFANTRY' },
      { title: 'PDS', slot: 'TF_UNIT_UPGRADE_PDS' },
    ],
  },
  { title: 'RELIC', slot: 'RELIC', neutral: false },
  { title: 'ENVIRONMENT', slot: 'ENVIRONMENT' },
  { title: 'ADVANCED', slot: 'ADVANCED' },
] as const satisfies readonly SlotEntry[]

export type AbilitySlot = SlotNames<(typeof SLOTS)[number]>
