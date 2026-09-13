import type { SlotEntry, SlotNames } from '@/types'

/**
 * The system's ability layout in render order: every slot's title, how it is
 * sourced, and which slots share a category header. A faction ability group
 * lands in the slot named after it (`hero` → `FACTION_HERO`), and a faction
 * unit's abilities in the slot named after its type (`FACTION_DREADNOUGHT`).
 * The same slot can appear twice under different strategies — the selected
 * faction's commander belongs under FACTION, everyone else's under COMMANDER —
 * and one entry may list several slots to render them under one sub-header.
 */
export const SLOTS = [
  { title: 'GENERAL', slot: 'GENERAL' },
  {
    title: 'FACTION',
    items: [
      { title: 'ABILITY', slot: 'FACTION_ABILITY', strategy: 'OWN' },
      { title: 'FLAGSHIP', slot: 'FACTION_FLAGSHIP', strategy: 'OWN' },
      // The FACTION header already names the faction; drop the card icons.
      {
        title: 'AGENT',
        slot: 'FACTION_AGENT',
        strategy: 'OWN',
        icon: false,
      },
      {
        title: 'COMMANDER',
        slot: 'FACTION_COMMANDER',
        strategy: 'OWN',
        icon: false,
      },
      { title: 'HERO', slot: 'FACTION_HERO', strategy: 'OWN' },
      { title: 'MECH', slot: 'FACTION_MECH', strategy: 'OWN' },
      { title: 'BREAKTHROUGH', slot: 'FACTION_BREAKTHROUGH', strategy: 'OWN' },
      { title: 'TECHNOLOGY', slot: 'FACTION_TECHNOLOGY', strategy: 'OWN' },
      {
        title: 'UNIT',
        slot: [
          'FACTION_WAR_SUN',
          'FACTION_DREADNOUGHT',
          'FACTION_CARRIER',
          'FACTION_CRUISER',
          'FACTION_DESTROYER',
          'FACTION_FIGHTER',
          'FACTION_INFANTRY',
          'FACTION_PDS',
          'FACTION_SPACE_DOCK',
        ],
        strategy: 'OWN',
      },
    ],
  },
  // Neutral is a generic opponent: no research, hand, notes, or leaders
  // beyond the agents anyone might have handed it.
  { title: 'TECHNOLOGY', slot: 'TECHNOLOGY', neutral: false },
  { title: 'ACTION CARD', slot: 'ACTION_CARD', neutral: false },
  {
    title: 'PROMISSORY',
    slot: 'FACTION_PROMISSORY',
    strategy: 'ALL',
    neutral: false,
  },
  { title: 'AGENT', slot: 'FACTION_AGENT', strategy: 'OTHER' },
  {
    title: 'COMMANDER',
    slot: 'FACTION_COMMANDER',
    strategy: 'OTHER',
    neutral: false,
  },
  { title: 'RELIC', slot: 'RELIC', neutral: false },
  { title: 'AGENDA', slot: 'AGENDA', neutral: false },
  { title: 'ENVIRONMENT', slot: 'ENVIRONMENT' },
  { title: 'OTHER', slot: 'OTHER', strategy: 'OTHER' },
  { title: 'ADVANCED', slot: 'ADVANCED' },
] as const satisfies readonly SlotEntry[]

export type AbilitySlot = SlotNames<(typeof SLOTS)[number]>
