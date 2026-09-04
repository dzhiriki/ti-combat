import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

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
// alphabetically. The registration site turns each bucket into the panel's
// sub-header.
export default {
  FLAGSHIP: flagship,
  WAR_SUN: warSun,
  DREADNOUGHT: dreadnought,
  CARRIER: carrier,
  CRUISER: cruiser,
  DESTROYER: destroyer,
  FIGHTER: fighter,
  MECH: mech,
  INFANTRY: infantry,
  PDS: pds,
} satisfies Partial<Record<UnitBaseType, readonly Ability[]>>
