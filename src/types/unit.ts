import type { Ability } from '@/combat'
import type { baseUnits } from '@/data/main'

import type { DiceGroup } from './die'
import type { Lazy } from './faction'

export type UnitVariantId = string & { readonly __brand: 'UnitVariantId' }

export type UnitBaseType = keyof typeof baseUnits | 'FLAGSHIP' | 'MECH'
type UnitVariant = `${UnitBaseType}:${UnitVariantId}`
export type UnitType = UnitBaseType | UnitVariant

// Unit abilities
interface UnitAbilities {
  SUSTAIN_DAMAGE?: boolean
  BOMBARDMENT?: DiceGroup
  AFB?: DiceGroup
  SPACE_CANNON?: DiceGroup
  PLANETARY_SHIELD?: boolean
  PRODUCTION?: number
  DEPLOY?: Ability
}

export type UnitAbility = keyof UnitAbilities

export interface UnitStats {
  NAME?: string
  DESCRIPTION?: string
  COST?: number | null
  COMBAT?: DiceGroup | null
  MOVE?: number | null
  CAPACITY?: number | null
  CAPACITY_COST?: number | null
  /** Carried unit types that ride free of capacity while a unit with this
   *  stat is alive on the side (A Strangled Whisper: infantry and fighters
   *  don't count against capacity, but mechs still do). Checked against
   *  living units, so the exemption ends when the carrier dies. */
  FREE_CARGO?: readonly UnitBaseType[]
  FLEET_POOL_COST?: number
  DIRECT_HIT_IMMUNE?: boolean
  UNIT_ABILITIES?: UnitAbilities
  ABILITIES?: readonly Ability[]
}

export interface UnitDefinition {
  BASE: UnitStats
  UPGRADED?: Partial<UnitStats>
}

/** Authoring shape of a unit's stats: `ABILITIES` may be computed from the
 *  data registry. Resolved to `UnitStats` by the system index. */
export type UnitStatsInput = Omit<UnitStats, 'ABILITIES'> & {
  ABILITIES?: Lazy<readonly Ability[]>
}

export interface UnitDefinitionInput {
  BASE: UnitStatsInput
  UPGRADED?: Partial<UnitStatsInput>
}

export interface UnitState {
  isDamaged?: boolean
  usedSustainThisRound?: boolean
}

export type Unit = UnitStats &
  UnitState & {
    subtypes?: string[]
  }

/** Branded unique identifier for a unit instance. A UnitId is a single
 *  UTF-16 code unit (char) above the ASCII range, so a collection of
 *  UnitIds can be stored as a plain string and used directly as a
 *  state-identity hash without per-call conversion. */
export type UnitId = string & { readonly __brand: 'UnitId' }

/** A packed list of UnitIds, stored as a string with one UTF-16 char
 *  per UnitId. Same runtime shape as `string`, but brand-distinct so a
 *  general string can't be passed where a unit-list is expected. Use
 *  `as UnitIdList` at construction sites (`arr.join('')`, slicing,
 *  concatenation) and iterate with `for (const c of list)` (each char
 *  is a UnitId — cast `as UnitId` when needed). */
export type UnitIdList = string & { readonly __brand: 'UnitIdList' }

/** Unified shape for ability list params that the `<List>` UI component edits.
 *  - `UnitList` (V = never)        → `[UnitType][]`        (order mode)
 *  - `UnitList<boolean>`           → `[UnitType, boolean][]` (checkbox mode)
 *  - `UnitList<number>`            → `[UnitType, number][]`  (number mode)
 *  Override the key type with the second generic for non-unit lists, e.g.
 *  `UnitList<boolean, MetaPhase>` or `UnitList<never, string>`. */
export type UnitList<V = never, K extends string = UnitType> = [V] extends [
  never,
]
  ? [K][]
  : [K, V][]
