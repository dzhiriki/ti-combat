import { makeVariantId } from '@/combat'
import type {
  DeclaredSubtype,
  RegisteredAbility,
  UnitCategoryOptions,
} from '@/combat/abilities-engine/types'
import { SHIPS, STRUCTURES } from '@/constants/units'
import type {
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitIdList,
  UnitStats,
} from '@/types'
import {
  createDefaultSurfaces,
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
} from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'
import { getSimulationUnitsOnSurfaces } from '@/utils/get-simulation-units'
import {
  createEmptySurfaceSelections,
  defaultSurfaceId,
} from '@/utils/surface-placements'

import { CombatState } from '../../combat/combat-state/combat-state'
import type { UnitStatsEntry } from '../../combat/combat-state/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
  SideStateData,
} from '../../combat/combat-state/types'
import { applyAbilityPlacementOverrides } from './ability-placement'
import { prepareSimulationConfig } from './prepare-simulation-config'
import { clampLimitParams } from './reconcile'

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface SideConfig {
  faction: string
  units: Partial<Record<UnitBaseType, number>>
  /** Explicit placement used by surface-focused tests. `units` remains a
   *  compact authoring adapter and is ignored when placements are supplied. */
  placements?: Record<string, Partial<Record<UnitBaseType, number>>>
  upgrades?: UnitBaseType[]
  abilities?: Record<string, true | false | Record<string, unknown>>
}

export interface CombatStateConfig {
  system: GameSystem
  mode: CombatMode
  surfaces?: SurfaceDefinition[]
  activeSurfaceId?: SurfaceId
  attacker: SideConfig
  defender: SideConfig
  customAbilities?: import('../../combat/abilities-engine/types').Ability[]
  /** Hook invoked after `prepareSimulationConfig` and before
   *  `forSimulation`, with mutable per-side registered ability arrays. Test
   *  harnesses use it to shuffle iteration order; production leaves it
   *  unset. */
  prepareAbilities?: (abilities: {
    attacker: import('../../combat/abilities-engine/types').RegisteredAbility[]
    defender: import('../../combat/abilities-engine/types').RegisteredAbility[]
  }) => void
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildSideState(
  system: GameSystem,
  config: SideConfig,
  abilities: SideAbilitiesConfig,
  registeredAbilities: readonly RegisteredAbility[],
  gen: { _nextCode?: number },
  side: CombatSide,
  surfaces: SurfaceDefinition[],
  activeSurfaceId: SurfaceId,
  declaredSubtypes: readonly DeclaredSubtype[],
  unitCategoryOptions: UnitCategoryOptions,
): SideStateData {
  const upgradedSet = new Set(config.upgrades ?? [])
  const placements = createEmptySurfaceSelections(surfaces)
  const unitStats: Record<string, UnitStats> = {}

  const factionConfig = getFactionUnitConfig(system, config.faction)
  const placementStats = applyAbilityPlacementOverrides(
    buildUnitStatsMap(system, config.faction, upgradedSet),
    registeredAbilities,
    abilities,
  )

  const rawPlacements = config.placements
    ? Object.entries(config.placements).flatMap(([surfaceId, units]) =>
        Object.entries(units).map(([type, count]) => ({
          surfaceId: surfaceId as SurfaceId,
          type,
          count,
        })),
      )
    : Object.entries(config.units).flatMap(([type, count]) => {
        const starlancer = config.abilities?.['TF_STARLANCER_XI']
        const ground =
          type === 'MECH' &&
          typeof starlancer === 'object' &&
          typeof starlancer.mechsOnGround === 'number'
            ? Math.min(count ?? 0, Math.max(0, starlancer.mechsOnGround))
            : 0
        if (ground > 0) {
          const spaceId = surfaces.find(s => s.type === 'SPACE')!.id
          const planetId = surfaces.find(s => s.type === 'PLANET')!.id
          return [
            { surfaceId: spaceId, type, count: (count ?? 0) - ground },
            { surfaceId: planetId, type, count: ground },
          ]
        }
        // Flat test shorthand preserves the old combat-pool meaning while
        // still producing legal locations: ships are in space, structures
        // are on the first planet, and ground forces start on the active
        // combat surface. Surface-specific tests use `placements` to exercise
        // commitment and multi-planet behavior.
        const surfaceId = SHIPS.includes(type as UnitBaseType)
          ? surfaces.find(s => s.type === 'SPACE')!.id
          : STRUCTURES.includes(type as UnitBaseType)
            ? surfaces.find(s => s.type === 'PLANET')!.id
            : activeSurfaceId
        return [{ surfaceId, type, count }]
      })

  for (const { surfaceId, type, count } of rawPlacements) {
    const unitType_ = type as UnitBaseType
    if (!count || count <= 0) continue

    const def = factionConfig[unitType_]
    if (!def?.BASE) continue

    const upgraded = upgradedSet.has(unitType_)
    let stats: UnitStats = { ...def.BASE }
    if (upgraded && def.UPGRADED) {
      stats = {
        ...stats,
        ...def.UPGRADED,
        UNIT_ABILITIES: {
          ...stats.UNIT_ABILITIES,
          ...def.UPGRADED.UNIT_ABILITIES,
        },
      }
    }

    const destination =
      surfaceId ??
      defaultSurfaceId(
        surfaces,
        activeSurfaceId,
        side,
        unitType_,
        placementStats[unitType_] ?? stats,
      )
    if (!placements[destination]) continue
    placements[destination][unitType_] = {
      count: placements[destination][unitType_].count + count,
      upgraded,
    }
    unitStats[unitType_] = stats
  }

  const built = getSimulationUnitsOnSurfaces(
    system,
    config.faction,
    placements as SurfaceUnitSelections,
    surfaces,
    gen,
    placementStats,
  )

  const baseUnitStats: Record<string, UnitStatsEntry> = {
    ...buildUnitStatsMap(system, config.faction, upgradedSet),
    ...unitStats,
  }

  // Pre-populate variant stats. Store the factory rather than its eager
  // result so the variant tracks runtime mutations of its parent (e.g.
  // Eidolon flipping MECH stats at start of combat) — `resolveUnitStats`
  // applies the factory lazily on lookup.
  for (const decl of declaredSubtypes) {
    const variantKey = makeVariantId(decl.unitType, [decl.name])
    if (baseUnitStats[variantKey]) continue
    baseUnitStats[variantKey] = decl.statsFactory
  }

  return {
    faction: config.faction,
    participatingUnits: built.units,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: built.surfaceUnits,
    unitSurface: built.unitSurface,
    unitType: built.unitType,
    unitState: built.unitState,
    unitStats: baseUnitStats as Record<
      import('@/types').UnitType,
      UnitStatsEntry
    >,
    declaredSubtypes,
    unitCategoryOptions,
    abilities,
    liveAbilities: {},
  }
}

function buildSideAbilitiesConfig(config: SideConfig): SideAbilitiesConfig {
  const result: SideAbilitiesConfig = {}
  if (!config.abilities) return result

  for (const [key, value] of Object.entries(config.abilities)) {
    if (value === true || value === false) {
      result[key] = { isEnabled: value }
    } else {
      result[key] = { ...value }
    }
  }
  return result
}

// ============================================================================
// FACTORY
// ============================================================================

export function buildCombatState(config: CombatStateConfig): CombatState {
  const surfaces = config.surfaces ?? createDefaultSurfaces()
  const activeSurfaceId =
    config.mode === 'SPACE'
      ? (surfaces.find(s => s.type === 'SPACE')?.id ?? SPACE_SURFACE_ID)
      : (config.activeSurfaceId ??
        surfaces.find(s => s.type === 'PLANET')?.id ??
        DEFAULT_PLANET_ID)
  const abilitiesConfig = {
    attacker: buildSideAbilitiesConfig(config.attacker),
    defender: buildSideAbilitiesConfig(config.defender),
  }

  const sideAbilities = prepareSimulationConfig(
    config.system,
    abilitiesConfig,
    config.attacker.faction,
    config.defender.faction,
    config.mode,
    config.customAbilities,
  )

  const gen: { _nextCode?: number } = {}
  const attackerSide = buildSideState(
    config.system,
    config.attacker,
    abilitiesConfig.attacker,
    sideAbilities.attacker.registered,
    gen,
    'attacker',
    surfaces,
    activeSurfaceId,
    sideAbilities.attacker.metadata.subtypes,
    sideAbilities.attacker.metadata.categories,
  )
  const defenderSide = buildSideState(
    config.system,
    config.defender,
    abilitiesConfig.defender,
    sideAbilities.defender.registered,
    gen,
    'defender',
    surfaces,
    activeSurfaceId,
    sideAbilities.defender.metadata.subtypes,
    sideAbilities.defender.metadata.categories,
  )

  // Stateful clamp pass: with real per-side state now built, clamp IN_COMBAT
  // and EXTRA values that bypassed the UI hook (e.g. tests that hand-feed
  // over-limit values via `buildCombatState`).
  clampLimitParams(
    abilitiesConfig,
    {
      attacker: sideAbilities.attacker.registered,
      defender: sideAbilities.defender.registered,
    },
    { attacker: attackerSide, defender: defenderSide },
  )

  config.prepareAbilities?.({
    attacker: sideAbilities.attacker.registered,
    defender: sideAbilities.defender.registered,
  })

  return CombatState.forSimulation(
    attackerSide,
    defenderSide,
    config.mode,
    surfaces,
    activeSurfaceId,
    {
      attacker: sideAbilities.attacker.registered,
      defender: sideAbilities.defender.registered,
    },
    {
      attacker: sideAbilities.attacker.unitAbilityKeys,
      defender: sideAbilities.defender.unitAbilityKeys,
    },
    {
      attacker: sideAbilities.attacker.factionOwnedKeys,
      defender: sideAbilities.defender.factionOwnedKeys,
    },
    gen._nextCode,
  )
}
