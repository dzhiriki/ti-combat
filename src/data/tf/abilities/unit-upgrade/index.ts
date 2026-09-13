import type { Ability } from '@/combat'

import carrier from './carrier'
import cruiser from './cruiser'
import destroyer from './destroyer'
import dreadnought from './dreadnought'
import fighter from './fighter'
import flagship from './flagship'
import infantry from './infantry'
import mech from './mech'
import pds from './pds'
import warSun from './war-sun'

// The Twilight's Fall unit-upgrade deck, one folder per unit type a card
// overrides. Non-mech upgrades are mutually exclusive per unit type (up to
// one cruiser card, one carrier card, etc. — enforced via a per-type
// exclusiveGroup); mech upgrades stack.
//
// A card carries a `description` only when it has a combat-affecting rule
// *beyond* its stat/ability changes (e.g. Strike Wing Alpha's AFB bonus).
// Plain stat upgrades carry no description so the UI shows nothing
// redundant. Capacity changes count (the capacity phase reads them), so
// every carrier card is present; only cards whose sole differences are
// movement / production / cost are omitted: all space-dock variants and
// Valefar Prime (mech cost).
//
// Key order IS display order: buckets follow the UI's unit ordering
// (UNIT_TYPES — Flagship, War Sun, Dreadnought, Carrier, Cruiser, Destroyer,
// Fighter, Mech, Infantry, PDS), and each folder lists its cards
// alphabetically. Each bucket is its own slot, so the deck spreads straight
// into the system's ability registration.
export default {
  TF_UNIT_UPGRADE_FLAGSHIP: flagship,
  TF_UNIT_UPGRADE_WAR_SUN: warSun,
  TF_UNIT_UPGRADE_DREADNOUGHT: dreadnought,
  TF_UNIT_UPGRADE_CARRIER: carrier,
  TF_UNIT_UPGRADE_CRUISER: cruiser,
  TF_UNIT_UPGRADE_DESTROYER: destroyer,
  TF_UNIT_UPGRADE_FIGHTER: fighter,
  TF_UNIT_UPGRADE_MECH: mech,
  TF_UNIT_UPGRADE_INFANTRY: infantry,
  TF_UNIT_UPGRADE_PDS: pds,
} satisfies Record<`TF_UNIT_UPGRADE_${string}`, readonly Ability[]>
