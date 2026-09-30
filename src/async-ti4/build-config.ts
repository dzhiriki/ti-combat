import { makeUnitLocator, type RegisteredAbility } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type {
  SerializedConfig,
  SerializedSurfaceCounts,
} from '@/hooks/combat-setup/serialization'
import {
  buildAbilityLookup,
  resolveSerializedGameSystem,
} from '@/hooks/combat-setup/validation'
import {
  SPACE_SURFACE_ID,
  type SurfaceId,
  type UnitBaseType,
  type UnitList,
  type UnitLocator,
} from '@/types'
import { findFaction } from '@/utils/find-faction'
import { GAME_SYSTEMS, getGameData } from '@/utils/get-game-data'

import { AsyncTi4Error } from './fetch-game'
import {
  entitiesAt,
  factionLabel,
  isModelledUnit,
  planetName,
} from './locations'
import {
  ABILITY_BY_TECH,
  ABILITY_BY_TF_UNIT,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
  UNIT_UPGRADE_BY_TECH,
  UNMODELLED_TECHS,
} from './mappings'
import { SPACE_STATIONS } from './planet-names'
import {
  type AsyncPlayer,
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

/** One surface of the calculator's system and the AsyncTI4 planet it stands
 *  for. Space has no planet; a placeholder planet has none either. */
interface ImportSurface {
  id: SurfaceId
  planet?: string
}

interface SideData {
  faction: string
  counts: SerializedSurfaceCounts
  upgrades: UnitBaseType[]
  abilities: Record<string, Record<string, unknown>>
}

/** The surfaces the battle is fought across: the system's space area and the
 *  planets that matter to it.
 *
 *  Neither combat is confined to its own area of the map. A space battle is
 *  shot at by the structures on the system's planets, and an invasion is
 *  carried and bombarded by the fleet overhead. The calculator models the
 *  whole system, so every planet either side is standing on comes along, and
 *  the engine works out who takes part. Planets nobody in the fight is on are
 *  left out: they would only clutter the editor.
 *
 *  The invaded planet always comes first, so a ground battle is fought on
 *  Planet 1. A system with no planet worth carrying still gets one, empty, so
 *  the calculator has somewhere to land on. */
function battleSurfaces(
  data: WebData,
  location: BattleLocation,
  sides: readonly string[],
): ImportSurface[] {
  const candidates = Object.keys(
    data.tileUnitData[location.tile]?.planets ?? {},
  ).filter(planet => !SPACE_STATIONS.has(planet))

  const occupied = candidates.filter(
    planet =>
      planet === location.planet ||
      sides.some(side =>
        entitiesAt(data, { tile: location.tile, planet }, side).some(
          isModelledUnit,
        ),
      ),
  )
  const ordered =
    location.planet && occupied.includes(location.planet)
      ? [location.planet, ...occupied.filter(p => p !== location.planet)]
      : occupied

  const planets: ImportSurface[] = ordered.map((planet, index) => ({
    id: `planet-${index + 1}` as SurfaceId,
    planet,
  }))
  if (planets.length === 0) planets.push({ id: 'planet-1' as SurfaceId })
  return [{ id: SPACE_SURFACE_ID }, ...planets]
}

/** Upstream aliases the Alliance promissory note `<colour>_an`. */
const ALLIANCE_SUFFIX = '_an'

/** Whether this player's commander has come off its unlock condition.
 *
 *  Only an explicit `false` counts as unlocked. A commander the import misses
 *  is one the user can switch on themselves; one it invents changes the odds
 *  under them, so an absent flag leaves the card alone. */
function hasUnlockedCommander(player: AsyncPlayer | undefined): boolean {
  return (player?.leaders ?? []).some(
    leader => leader.type === 'commander' && leader.locked === false,
  )
}

/** The commander ability this calculator models for a faction, if any.
 *
 *  Read off the faction sheets rather than a table of its own, so modelling a
 *  new commander is enough to make the import carry it. Most commanders do
 *  nothing to a combat and aren't modelled at all; those resolve to nothing
 *  and are skipped in silence. */
function commanderAbilityKey(asyncFactionId: string): string | undefined {
  const factionKey = FACTION_BY_ASYNC_ID[asyncFactionId]
  return factionKey
    ? findFaction(factionKey)?.abilities?.commander?.[0]?.key
    : undefined
}

/** Every commander this side can use.
 *
 *  A commander is on from the moment it unlocks — nothing to spend, nothing
 *  to exhaust — so an unlocked one belongs in the import rather than being
 *  left for the user to remember. A side can also be using someone else's:
 *  an Alliance note in the play area lends its owner's, and Mahact's Imperia
 *  ("while another player's command token is in your fleet pool, you can use
 *  the ability of that player's commander, if it is unlocked") does the same
 *  for every colour in their fleet pool. Both borrow on the same condition —
 *  the lender's own commander has to be unlocked — so both resolve through
 *  the same colour lookup. Mahact purges its Alliance note on setup, so the
 *  two routes never overlap. */
function commanderKeys(data: WebData, asyncFactionId: string): string[] {
  const player = data.playerData.find(p => p.faction === asyncFactionId)
  if (!player) return []

  const lenders = [
    ...(hasUnlockedCommander(player) ? [asyncFactionId] : []),
    ...borrowedFrom(data, player),
  ]
  return lenders
    .map(commanderAbilityKey)
    .filter((key): key is string => key !== undefined)
}

/** The faction ids whose commanders this player is borrowing. */
function borrowedFrom(data: WebData, player: AsyncPlayer): string[] {
  const colours = [
    ...(player.promissoryNotesInPlayArea ?? [])
      .filter(note => note.endsWith(ALLIANCE_SUFFIX))
      .map(note => note.slice(0, -ALLIANCE_SUFFIX.length)),
    ...(player.mahactEdict ?? []),
  ]

  const borrowed: string[] = []
  for (const colour of colours) {
    const lender = data.playerData.find(p => p.color === colour)
    if (lender && hasUnlockedCommander(lender)) borrowed.push(lender.faction)
  }
  return borrowed
}

function buildSide(
  data: WebData,
  location: BattleLocation,
  surfaces: readonly ImportSurface[],
  asyncFactionId: string,
  abilityLookup: Map<string, RegisteredAbility>,
  notes: Set<string>,
): SideData {
  const faction = FACTION_BY_ASYNC_ID[asyncFactionId]
  if (!faction) {
    throw new AsyncTi4Error(
      `This calculator has no faction sheet for "${asyncFactionId}"`,
    )
  }

  // Units stay where they stand — ships and cargo in space, ground forces and
  // structures on their planets. Pre-set state is keyed by surface as well as
  // type, since the calculator tells a damaged mech on the planet from one
  // riding in the fleet.
  const counts: SerializedSurfaceCounts = {}
  const damaged: UnitList<number> = []
  const galvanized: UnitList<number> = []
  const requested: Partial<Record<UnitBaseType, number>> = {}
  const remaining = { ...UNIT_LIMITS }

  for (const surface of surfaces) {
    // A placeholder planet stands for nothing on the map, so nothing is on
    // it; without the check its missing name would read as the space area.
    if (surface.id !== SPACE_SURFACE_ID && surface.planet === undefined) {
      continue
    }
    const entities = entitiesAt(
      data,
      { tile: location.tile, planet: surface.planet },
      asyncFactionId,
    )
    for (const entity of entities) {
      if (entity.entityType !== 'unit') continue
      const type = UNIT_TYPE_BY_ASYNC_ID[entity.entityId]
      if (!type) {
        notes.add(
          `${factionLabel(asyncFactionId)}: "${entity.entityId}" has no equivalent here`,
        )
        continue
      }
      requested[type] = (requested[type] ?? 0) + entity.count
      // The calculator caps each type across the whole system, so a stack
      // past the cap is trimmed where it stands and the rest go unplaced.
      const count = Math.min(entity.count, remaining[type])
      remaining[type] -= count
      if (count <= 0) continue
      const bySurface = (counts[surface.id] ??= {})
      bySurface[type] = (bySurface[type] ?? 0) + count

      // `[healthy, damaged, galvanized, damaged galvanized]`, falling back to
      // a flat stack when upstream omits the breakdown.
      const states = entity.unitStates ?? [entity.count, 0, 0, 0]
      const locator = makeUnitLocator(type, surface.id)
      // Fighters can't take damage, and the ability's own picker excludes them.
      if (type !== 'FIGHTER') {
        addPreset(damaged, locator, (states[1] ?? 0) + (states[3] ?? 0), count)
      }
      addPreset(galvanized, locator, (states[2] ?? 0) + (states[3] ?? 0), count)
    }
  }

  for (const [type, total] of Object.entries(requested) as [
    UnitBaseType,
    number,
  ][]) {
    const limit = UNIT_LIMITS[type]
    if (total > limit) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${total} ${type} capped at the ${limit} this calculator allows`,
      )
    }
  }

  const player = data.playerData.find(p => p.faction === asyncFactionId)
  const techs = player?.techs ?? []

  const upgrades = new Set<UnitBaseType>()
  const abilities: Record<string, Record<string, unknown>> = {}

  for (const tech of techs) {
    const upgrade = UNIT_UPGRADE_BY_TECH[tech]
    // Researched upgrades are recorded even where the side has none of that
    // unit here, so the stats are already right when units get added by hand.
    if (upgrade) upgrades.add(upgrade)

    const unmodelled = UNMODELLED_TECHS[tech]
    if (unmodelled) {
      notes.add(
        `${factionLabel(asyncFactionId)}: ${unmodelled} is not modelled`,
      )
    }

    const mapped = ABILITY_BY_TECH[tech]
    if (!mapped) continue
    // One tech can name more than one key where a faction reimplements the
    // card. Every candidate is set; `loadConfig` drops the ones the side's
    // faction doesn't have.
    for (const abilityKey of typeof mapped === 'string' ? [mapped] : mapped) {
      const ability = abilityLookup.get(abilityKey)
      if (!ability) continue
      // Cards gated on a charge count (`headerUI: 'uses'`) start at zero uses,
      // so owning one has to grant a use rather than flip `isEnabled`.
      abilities[abilityKey] =
        ability.headerUI === 'uses' ? { uses: 1 } : { isEnabled: true }
    }
  }

  // Twilight's Fall keeps its unit upgrades in the shared card deck, so they
  // arrive as owned unit sheets rather than researched techs.
  for (const owned of player?.unitsOwned ?? []) {
    const abilityKey = ABILITY_BY_TF_UNIT[owned]
    if (abilityKey && abilityLookup.has(abilityKey)) {
      abilities[abilityKey] = { isEnabled: true }
    }
  }

  // A commander borrowed through an Alliance note belongs to another faction,
  // which the cross-faction commander pool already offers every side. One that
  // doesn't fit — a side that has no commanders at all, or a commander whose
  // card only bears on the other side of the fight — is dropped by
  // `loadConfig` the same way a mismatched tech is.
  for (const abilityKey of commanderKeys(data, asyncFactionId)) {
    if (abilityLookup.has(abilityKey)) {
      abilities[abilityKey] = { isEnabled: true }
    }
  }

  if (damaged.length > 0) {
    abilities['PRE_DAMAGED'] = { damagedUnits: damaged }
  }
  if (galvanized.length > 0) {
    abilities['PRE_GALVANIZED'] = { galvanizedUnits: galvanized }
  }
  const tokens = player?.galvanizeTokensReinf ?? 0
  if (tokens > 0) {
    abilities['PRE_GALVANIZED'] = {
      ...abilities['PRE_GALVANIZED'],
      reinforcementTokens: tokens,
    }
  }

  return { faction, counts, upgrades: [...upgrades], abilities }
}

/** Record `count` more units in a pre-set state on one surface, no more than
 *  actually stand there once the cap has been applied. */
function addPreset(
  list: UnitList<number>,
  locator: UnitLocator,
  count: number,
  placed: number,
): void {
  const value = Math.min(count, placed)
  if (value <= 0) return
  const existing = list.find(([key]) => key === locator)
  if (existing) existing[1] += value
  else list.push([locator, value])
}

/** Turn a chosen location and pair of players into a config the calculator can
 *  load, alongside notes on anything that didn't survive the trip. */
export function buildImportConfig(
  data: WebData,
  selection: ImportSelection,
): ImportResult {
  const notes = new Set<string>()
  const { location } = selection
  // Which system this game runs under is only settled once both sides are
  // built, so the lookup spans every system; a key shared between systems
  // resolves to the same card wherever it appears.
  const abilityLookup = buildAbilityLookup(
    GAME_SYSTEMS.flatMap(system => getGameData(system).allAbilities),
  )

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
  const surfaces = battleSurfaces(data, location, [
    selection.attacker,
    selection.defender,
  ])
  const attacker = buildSide(
    data,
    location,
    surfaces,
    selection.attacker,
    abilityLookup,
    notes,
  )
  const defender = buildSide(
    data,
    location,
    surfaces,
    selection.defender,
    abilityLookup,
    notes,
  )

  // The calculator numbers its planets rather than naming them, so once there
  // is more than one the user needs telling which is which.
  const planets = surfaces.filter(surface => surface.planet !== undefined)
  if (planets.length > 1) {
    notes.add(
      planets
        .map(
          (surface, index) =>
            `Planet ${index + 1} is ${planetName(surface.planet!)}`,
        )
        .join(', '),
    )
  }

  // A nebula or an entropic scar is a property of the system, so it applies to
  // whoever fights there. Both sides get it: the scar syncs across them, and
  // the nebula is registered on the defender alone, so an entry for a side
  // that doesn't have the card is dropped when the config loads.
  if (location.environment) {
    const environment = abilityLookup.get(location.environment)
    if (environment) {
      attacker.abilities[location.environment] = { isEnabled: true }
      defender.abilities[location.environment] = { isEnabled: true }
    }
  }

  // The full editor is the one that shows a system's planets, and the
  // invaded planet is first in the list. The whole system was imported, so
  // the editor mode is the one the import needs rather than a preference.
  const planetIds = surfaces.slice(1).map(surface => surface.id)
  return {
    config: {
      v: 2,
      g: resolveSerializedGameSystem({
        af: attacker.faction,
        df: defender.faction,
      }),
      af: attacker.faction,
      df: defender.faction,
      m: location.mode === 'SPACE' ? 'S' : 'G',
      e: 'F',
      p: planetIds,
      sp: planetIds[0],
      asu: attacker.counts,
      dsu: defender.counts,
      aup: attacker.upgrades,
      dup: defender.upgrades,
      aa: attacker.abilities,
      da: defender.abilities,
    },
    notes: [...notes],
  }
}
