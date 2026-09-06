import type { Ability } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import type { FactionKey, UnitBaseType, UnitList } from '@/types'

import { AsyncTi4Error } from './fetch-game'
import { entitiesAt, factionLabel } from './locations'
import {
  ABILITY_BY_TECH,
  ABILITY_BY_TF_UNIT,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
  UNIT_UPGRADE_BY_TECH,
  UNMODELLED_TECHS,
} from './mappings'
import {
  type AsyncEntity,
  type BattleLocation,
  EXPECTED_SCHEMA_VERSION,
  type WebData,
} from './types'

export interface ImportSelection {
  location: BattleLocation
  /** AsyncTI4 faction ids. */
  attacker: string
  defender: string
}

export interface ImportResult {
  config: SerializedConfig
  /** Anything the import could not carry across, for display after applying. */
  notes: string[]
}

type UnitCounts = Partial<Record<UnitBaseType, number>>

interface SideData {
  faction: FactionKey
  units: Record<string, [number, 0 | 1]>
  abilities: Record<string, Record<string, unknown>>
}

function increment(counts: UnitCounts, type: UnitBaseType, by: number): void {
  if (by > 0) counts[type] = (counts[type] ?? 0) + by
}

function toUnitList(counts: UnitCounts): UnitList<number> {
  return Object.entries(counts).map(([type, count]) => [
    type,
    count,
  ]) as UnitList<number>
}

/** Structures sit on planets, so a space battle has to reach into the system's
 *  planets to find the PDS and space docks that shoot into it. */
function structuresInSystem(
  data: WebData,
  tile: string,
  asyncFactionId: string,
): AsyncEntity[] {
  const planets = data.tileUnitData[tile]?.planets ?? {}
  return Object.values(planets).flatMap(planet =>
    (planet?.entities?.[asyncFactionId] ?? []).filter(entity => {
      const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
      return type === 'PDS' || type === 'SPACE_DOCK'
    }),
  )
}

/** Everything a side brings to a battle at this location.
 *
 *  Neither combat is confined to its own area of the map. A space battle is
 *  fought by the fleet in the space area — ground forces riding along in it
 *  included, since they are what an invasion commits — plus the structures on
 *  the system's planets, which is where its space cannon fire comes from. A
 *  ground battle adds the fleet overhead to whoever already holds the planet:
 *  those ships carry the invading troops and fire the bombardment. */
function entitiesForBattle(
  data: WebData,
  location: BattleLocation,
  asyncFactionId: string,
): AsyncEntity[] {
  const inSpace = entitiesAt(
    data,
    { ...location, planet: undefined },
    asyncFactionId,
  )
  if (location.mode === 'SPACE') {
    return [
      ...inSpace,
      ...structuresInSystem(data, location.tile, asyncFactionId),
    ]
  }
  return [...entitiesAt(data, location, asyncFactionId), ...inSpace]
}

function buildSide(
  data: WebData,
  location: BattleLocation,
  asyncFactionId: string,
  abilityLookup: Map<string, Ability>,
  notes: Set<string>,
): SideData {
  const faction = FACTION_BY_ASYNC_ID[asyncFactionId]
  if (!faction) {
    throw new AsyncTi4Error(
      `This calculator has no faction sheet for "${asyncFactionId}"`,
    )
  }

  const entities = entitiesForBattle(data, location, asyncFactionId)

  const counts: UnitCounts = {}
  const damaged: UnitCounts = {}
  const galvanized: UnitCounts = {}

  for (const entity of entities) {
    if (entity.entityType !== 'unit') continue
    const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
    if (!type) {
      notes.add(
        `${factionLabel(asyncFactionId)}: "${entity.entityId}" has no equivalent here`,
      )
      continue
    }
    // `[healthy, damaged, galvanized, damaged galvanized]`, falling back to a
    // flat stack when upstream omits the breakdown.
    const states = entity.unitStates ?? [entity.count, 0, 0, 0]
    increment(counts, type, entity.count)
    increment(damaged, type, (states[1] ?? 0) + (states[3] ?? 0))
    increment(galvanized, type, (states[2] ?? 0) + (states[3] ?? 0))
  }

  const player = data.playerData.find(p => p.faction === asyncFactionId)
  const techs = player?.techs ?? []

  const upgraded = new Set<UnitBaseType>()
  const abilities: Record<string, Record<string, unknown>> = {}

  for (const tech of techs) {
    const upgrade = UNIT_UPGRADE_BY_TECH[tech]
    if (upgrade) upgraded.add(upgrade)

    const unmodelled = UNMODELLED_TECHS[tech]
    if (unmodelled) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${unmodelled} is not modelled`,
      )
    }

    const abilityKey = ABILITY_BY_TECH[tech]
    if (!abilityKey) continue
    const ability = abilityLookup.get(abilityKey)
    if (!ability) continue
    // Cards gated on a charge count (`headerUI: 'uses'`) start at zero uses, so
    // owning one has to grant a use rather than flip `isEnabled`.
    abilities[abilityKey] =
      ability.headerUI === 'uses' ? { uses: 1 } : { isEnabled: true }
  }

  // Twilight's Fall keeps its unit upgrades in the shared card deck, so they
  // arrive as owned unit sheets rather than researched techs.
  for (const owned of player?.unitsOwned ?? []) {
    const abilityKey = ABILITY_BY_TF_UNIT[owned]
    if (abilityKey && abilityLookup.has(abilityKey)) {
      abilities[abilityKey] = { isEnabled: true }
    }
  }

  const units: Record<string, [number, 0 | 1]> = {}
  for (const [type, count] of Object.entries(counts) as [
    UnitBaseType,
    number,
  ][]) {
    const limit = UNIT_LIMITS[type]
    if (count > limit) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${count} ${type} capped at the ${limit} this calculator allows`,
      )
    }
    units[type] = [Math.min(count, limit), upgraded.has(type) ? 1 : 0]
  }
  // Researched upgrades are recorded even where the side has none of that unit
  // here, so the stats are already right when units get added by hand.
  for (const type of upgraded) {
    units[type] ??= [0, 1]
  }

  // Fighters can't take damage, and the ability's own picker excludes them.
  delete damaged.FIGHTER
  if (Object.keys(damaged).length > 0) {
    abilities['PRE_DAMAGED'] = { damagedUnits: toUnitList(damaged) }
  }
  if (Object.keys(galvanized).length > 0) {
    abilities['PRE_GALVANIZED'] = { galvanizedUnits: toUnitList(galvanized) }
  }
  const tokens = player?.galvanizeTokensReinf ?? 0
  if (tokens > 0) {
    abilities['PRE_GALVANIZED'] = {
      ...abilities['PRE_GALVANIZED'],
      reinforcementTokens: tokens,
    }
  }

  return { faction, units, abilities }
}

/** Turn a chosen location and pair of players into a config the calculator can
 *  load, alongside notes on anything that didn't survive the trip. */
export function buildImportConfig(
  data: WebData,
  selection: ImportSelection,
  abilityLookup: Map<string, Ability>,
): ImportResult {
  const notes = new Set<string>()
  const { location } = selection

  // AsyncTI4 is maintained by another project, so treat a schema bump as a
  // hint that these mappings may have gone stale. It is only a warning: most
  // bumps won't touch the few fields read here, and refusing the import over
  // one would be worse than a slightly wrong one the user can see and correct.
  if (
    data.versionSchema != null &&
    data.versionSchema !== EXPECTED_SCHEMA_VERSION
  ) {
    notes.add(
      `AsyncTI4 data format is v${data.versionSchema}, this import expects v${EXPECTED_SCHEMA_VERSION} — some of it may be out of date`,
    )
  }
  const attacker = buildSide(
    data,
    location,
    selection.attacker,
    abilityLookup,
    notes,
  )
  const defender = buildSide(
    data,
    location,
    selection.defender,
    abilityLookup,
    notes,
  )

  return {
    config: {
      v: 1,
      af: attacker.faction,
      df: defender.faction,
      m: location.mode === 'SPACE' ? 'S' : 'G',
      au: attacker.units,
      du: defender.units,
      aa: attacker.abilities,
      da: defender.abilities,
    },
    notes: [...notes],
  }
}
