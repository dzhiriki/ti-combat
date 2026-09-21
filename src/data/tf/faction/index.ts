import { neutral } from '@/data/main/faction/neutral'
import type { FactionDefinition } from '@/types'

import { avarice_rex } from './avarice_rex'
import { el_nen_janovet } from './el_nen_janovet'
import { il_na_viroset } from './il_na_viroset'
import { il_sai_lakoe } from './il_sai_lakoe'
import { radiant_aur } from './radiant_aur'
import { ruby_monarch } from './ruby_monarch'
import { saint_of_swords } from './saint_of_swords'
import { sickening_lurch } from './sickening_lurch'

// Twilight's Fall factions, in registry order (the first is the system's
// default). Each contributes only a unique flagship and mech;
// all other units come from the shared TF roster (see ../base-units.ts).
// Kept separate from the TI4 roster so cross-faction TI4 aggregations
// (e.g. Nekro's flagship pool) don't pull in TF units.
export default {
  AVARICE_REX: avarice_rex,
  EL_NEN_JANOVET: el_nen_janovet,
  IL_NA_VIROSET: il_na_viroset,
  IL_SAI_LAKOE: il_sai_lakoe,
  RADIANT_AUR: radiant_aur,
  RUBY_MONARCH: ruby_monarch,
  SAINT_OF_SWORDS: saint_of_swords,
  SICKENING_LURCH: sickening_lurch,
  // Neutral has base-game stats and is offered in every system.
  NEUTRAL: neutral,
} satisfies Record<string, FactionDefinition>
