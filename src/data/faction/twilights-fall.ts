import type { Faction } from '@/types'

import { avarice_rex } from './avarice_rex'
import { el_nen_janovet } from './el_nen_janovet'
import { il_na_viroset } from './il_na_viroset'
import { il_sai_lakoe } from './il_sai_lakoe'
import { radiant_aur } from './radiant_aur'
import { ruby_monarch } from './ruby_monarch'
import { saint_of_swords } from './saint_of_swords'
import { sickening_lurch } from './sickening_lurch'

// Twilight's Fall factions. Each contributes only a unique flagship and mech;
// all other units come from the shared TF roster (see tf-base-units.ts).
// Kept separate from `otherFactions` so cross-faction TI4 aggregations
// (e.g. Nekro's flagship pool) don't pull in TF units.
export const twilightsFallFactions = {
  AVARICE_REX: avarice_rex,
  EL_NEN_JANOVET: el_nen_janovet,
  IL_NA_VIROSET: il_na_viroset,
  IL_SAI_LAKOE: il_sai_lakoe,
  RADIANT_AUR: radiant_aur,
  RUBY_MONARCH: ruby_monarch,
  SAINT_OF_SWORDS: saint_of_swords,
  SICKENING_LURCH: sickening_lurch,
} satisfies Record<string, Faction>
