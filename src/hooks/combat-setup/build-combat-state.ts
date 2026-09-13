import { makeVariantId } from '@/combat'
import type { DeclaredSubtype } from '@/combat/abilities-engine/types'
import type {
  GameSystem,
  UnitBaseType,
  UnitIdList,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import { CombatState } from '../../combat/combat-state/combat-state'
import type { UnitStatsEntry } from '../../combat/combat-state/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
  SideStateData,
} from '../../combat/combat-state/types'
import { nextUnitIds } from '../../combat/utils/unit-id'
import { prepareSimulationConfig } from './prepare-simulation-config'
import { clampLimitParams } from './reconcile'

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface SideConfig {
  faction: string
  units: Partial<Record<UnitBaseType, number>>
  upgrades?: UnitBaseType[]
  abilities?: Record<string, true | false | Record<string, unknown>>
}

export interface CombatStateConfig {
  system: GameSystem
  mode: CombatMode
  attacker: SideConfig
  defender: SideConfig
  customAbilities?: import('../../combat/abilities-engine/types').Ability[]
  /** Hook invoked after `prepareSimulationConfig` and before
   *  `forSimulation`, with mutable per-side registered ability arrays. Test
   *  harnesses use it to shuffle iteration order; production leaves it
   *  unset. */
  prepareAbilities?: (abilities: {
    attacker: import('@/types').CollectedAbility[]
    defender: import('@/types').CollectedAbility[]
  }) => void
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildSideState(
  system: GameSystem,
  config: SideConfig,
  abilities: SideAbilitiesConfig,
  gen: { _nextCode?: number },
): SideStateData {
  const upgradedSet = new Set(config.upgrades ?? [])
  let participatingUnits = ''
  const unitType: Record<string, UnitType> = {}
  const unitState: Record<string, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}

  const factionConfig = getFactionUnitConfig(system, config.faction)

  for (const [type, count] of Object.entries(config.units)) {
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

    const ids = nextUnitIds(count, gen)
    for (const id of ids) {
      participatingUnits += id
      unitType[id] = unitType_ as import('@/types').UnitType
    }
    unitStats[unitType_] = stats
  }

  const settings = abilities['SETTINGS'] as
    | { subtypes?: DeclaredSubtype[] }
    | undefined
  const declaredSubtypes = settings?.subtypes ?? []

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
    participatingUnits: participatingUnits as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    unitType,
    unitState,
    unitStats: baseUnitStats as Record<
      import('@/types').UnitType,
      UnitStatsEntry
    >,
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
    gen,
  )
  const defenderSide = buildSideState(
    config.system,
    config.defender,
    abilitiesConfig.defender,
    gen,
  )

  // Stateful clamp pass: with real per-side state now built, clamp IN_COMBAT
  // and EXTRA values that bypassed the UI hook (e.g. tests that hand-feed
  // over-limit values via `buildCombatState`).
  const flatAbilities = {
    attacker: sideAbilities.attacker.registered.map(r => r.ability),
    defender: sideAbilities.defender.registered.map(r => r.ability),
  }
  const dedupe = (
    arr: import('../../combat/abilities-engine/types').Ability[],
  ) => {
    const seen = new Set<string>()
    return arr.filter(a => (seen.has(a.key) ? false : (seen.add(a.key), true)))
  }
  clampLimitParams(
    abilitiesConfig,
    {
      attacker: dedupe(flatAbilities.attacker),
      defender: dedupe(flatAbilities.defender),
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
