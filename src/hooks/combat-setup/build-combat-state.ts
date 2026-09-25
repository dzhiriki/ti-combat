import { SHIPS, STRUCTURES } from '@/constants/units'
import type {
  GameSystem,
  SideUnitPlacements,
  SurfaceDefinition,
  SurfaceId,
  UnitBaseType,
} from '@/types'
import {
  createDefaultSurfaces,
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
} from '@/types'
import { createEmptySurfaceCounts } from '@/utils/surface-placements'

import { CombatState } from '../../combat/combat-state/combat-state'
import type {
  CombatMode,
  SideAbilitiesConfig,
} from '../../combat/combat-state/types'
import { buildSideState } from './build-side-state'
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

function adaptTestPlacements(
  config: SideConfig,
  surfaces: SurfaceDefinition[],
  activeSurfaceId: SurfaceId,
): SideUnitPlacements {
  const counts = createEmptySurfaceCounts(surfaces)
  if (config.placements) {
    for (const [surfaceId, units] of Object.entries(config.placements)) {
      const target = counts[surfaceId]
      if (!target) continue
      for (const [type, count] of Object.entries(units)) {
        if (count && Object.hasOwn(target, type))
          target[type as UnitBaseType] += count
      }
    }
  } else {
    for (const [type, count] of Object.entries(config.units)) {
      if (!count) continue
      const surfaceId = SHIPS.includes(type as UnitBaseType)
        ? SPACE_SURFACE_ID
        : STRUCTURES.includes(type as UnitBaseType)
          ? surfaces.find(s => s.type === 'PLANET')!.id
          : activeSurfaceId
      counts[surfaceId][type as UnitBaseType] += count
    }
  }
  return { counts, upgradedTypes: config.upgrades ?? [] }
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

  const attackerPlacements = adaptTestPlacements(
    config.attacker,
    surfaces,
    activeSurfaceId,
  )
  const defenderPlacements = adaptTestPlacements(
    config.defender,
    surfaces,
    activeSurfaceId,
  )

  const sideAbilities = prepareSimulationConfig(
    config.system,
    abilitiesConfig,
    config.attacker.faction,
    config.defender.faction,
    config.mode,
    config.customAbilities,
    {
      surfaces,
      activeSurfaceId,
      attacker: attackerPlacements,
      defender: defenderPlacements,
    },
  )

  const gen: { _nextCode?: number } = {}
  const attackerSide = buildSideState(
    config.system,
    config.attacker.faction,
    attackerPlacements,
    surfaces,
    abilitiesConfig.attacker,
    sideAbilities.attacker.registered,
    gen,
    sideAbilities.attacker.metadata.subtypes,
    sideAbilities.attacker.metadata.categories,
  )
  const defenderSide = buildSideState(
    config.system,
    config.defender.faction,
    defenderPlacements,
    surfaces,
    abilitiesConfig.defender,
    sideAbilities.defender.registered,
    gen,
    sideAbilities.defender.metadata.subtypes,
    sideAbilities.defender.metadata.categories,
  )

  attackerSide.unitCategoryChanges = sideAbilities.attacker.metadata.changes
  defenderSide.unitCategoryChanges = sideAbilities.defender.metadata.changes

  // Stateful clamp pass: with real per-side state now built, clamp IN_COMBAT
  // and EXTRA values that bypassed the UI hook (e.g. tests that hand-feed
  // over-limit values via `buildCombatState`).
  clampLimitParams(
    abilitiesConfig,
    {
      attacker: sideAbilities.attacker.registered,
      defender: sideAbilities.defender.registered,
    },
    {
      attacker: attackerSide,
      defender: defenderSide,
      surfaces,
      activeSurfaceId,
      combatMode: config.mode,
    },
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
