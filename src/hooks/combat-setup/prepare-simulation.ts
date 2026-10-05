import { createLookups } from '@/combat'
import type { SimulationSetup } from '@/combat/combat-state/combat-state'
import { makeVariantId } from '@/combat/utils/unit-variant'
import type { CollectedAbility, CombatSide, UnitStats } from '@/types'
import { getGameData } from '@/utils/get-game-data'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'
import { layoutContext } from '@/utils/layout-context'

import type { Ability } from '../../combat/abilities-engine/types'
import { applyDeclaredChanges } from './apply-declared-changes'
import { buildSideState } from './build-side-state'
import {
  clampLimitParams,
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  restoreConsumerParams,
  snapshotConsumerParams,
} from './reconcile'
import type { SimulationInput } from './types'

/**
 * Prepare a simulation: build both sides from their placements and run the
 * full reconcile pipeline on `input.abilities` (snapshot user params →
 * reconcile → restore user selections → clamp), producing a config ready for
 * the AbilitiesEngine with no further reconciliation needed.
 */
export function prepareSimulation(
  input: Omit<SimulationInput, 'precision'>,
  customAbilities: readonly Ability[] = [],
): SimulationSetup {
  const { system, abilities: config, combatMode, surfaces } = input
  const gameData = getGameData(system)
  const factions = {
    attacker: input.attackerFaction,
    defender: input.defenderFaction,
  }
  const placements = {
    attacker: input.attackerPlacements,
    defender: input.defenderPlacements,
  }
  // Custom abilities (tests, ad-hoc probes) aren't collected from any slot
  // config and never reach the panel; file them under OTHER so they flow
  // through the same registered pipeline.
  const customRegistered: CollectedAbility[] = customAbilities.map(ability => ({
    ...ability,
    slot: 'OTHER',
  }))
  const registered = {
    attacker: [
      ...gameData.getAvailableAbilities(
        'attacker',
        factions.attacker,
        new Set(placements.attacker.upgradedTypes),
        layoutContext(surfaces),
      ),
      ...customRegistered,
    ],
    defender: [
      ...gameData.getAvailableAbilities(
        'defender',
        factions.defender,
        new Set(placements.defender.upgradedTypes),
        layoutContext(surfaces),
      ),
      ...customRegistered,
    ],
  }

  // A multi-planet invasion starts on its first planet; settings reconcile
  // against every planet it fights on, as the panel shows them.
  const planets = input.invasionPlanets
  const invasion =
    combatMode === 'GROUND' && planets && planets.length > 1
      ? { planets: [...planets], results: [] }
      : undefined
  const activeSurfaceId = invasion?.planets[0] ?? input.activeSurfaceId

  const savedParams = snapshotConsumerParams(config, registered)
  // Materialize every registered ability's static defaults into the config so
  // `sideData.abilities` carries a base entry for all of them (uses, isEnabled,
  // and simple defaults). Runs AFTER the snapshot so it only fills gaps —
  // snapshot/restore must not capture these defaults and overwrite reconciled
  // sync values. Mirrors the UI store's setup (combat-setup.ts).
  initializeAbilityDefaults(config, registered)
  // Units are placed on the surfaces the declared changes allow.
  const declaredSide = (side: CombatSide) => ({
    faction: factions[side],
    unitStats: buildUnitStatsMap(
      system,
      factions[side],
      new Set(placements[side].upgradedTypes),
    ),
    config: config[side],
    abilities: registered[side],
  })
  const declared = applyDeclaredChanges(
    { attacker: declaredSide('attacker'), defender: declaredSide('defender') },
    surfaces,
    combatMode,
    activeSurfaceId,
    invasion,
  )
  const gen: { _nextCode?: number } = {}
  const state = {
    attacker: buildSideState(
      system,
      factions.attacker,
      placements.attacker,
      surfaces,
      config.attacker,
      declared.attacker.model.unitStats as Record<string, UnitStats>,
      gen,
    ),
    defender: buildSideState(
      system,
      factions.defender,
      placements.defender,
      surfaces,
      config.defender,
      declared.defender.model.unitStats as Record<string, UnitStats>,
      gen,
    ),
    surfaces: [...surfaces],
    activeSurfaceId,
    invasion,
    combatMode,
  }
  const metadata = reconcileAbilitiesConfig(
    config,
    registered,
    combatMode,
    state,
    createLookups(registered),
  )
  restoreConsumerParams(config, registered, savedParams)

  for (const side of ['attacker', 'defender'] as const) {
    // Register declared subtypes as factories so `resolveUnitStats`
    // re-evaluates them lazily against the *current* parent stats. Eager
    // evaluation would freeze the variant before runtime mutators like Reveal
    // Prototype's `modifyUnitType` upgrade the base — Viscount on an upgraded
    // Cruiser must reflect the upgrade.
    const unitStats = { ...state[side].unitStats }
    for (const decl of metadata[side].subtypes) {
      unitStats[makeVariantId(decl.unitType, [decl.name])] ??= decl.statsFactory
    }
    state[side].unitStats = unitStats
  }
  // Restored user values (including hand-fed test values) may exceed the
  // per-variant caps the controls offered; clamp them in place.
  clampLimitParams(config, registered, state)

  return {
    attacker: state.attacker,
    defender: state.defender,
    combatMode,
    surfaces: input.surfaces,
    activeSurfaceId,
    invasion,
    abilities: registered,
    unitAbilityKeys: {
      attacker: gameData.getUnitDefinitionAbilityKeys(factions.attacker),
      defender: gameData.getUnitDefinitionAbilityKeys(factions.defender),
    },
    factionOwnedKeys: {
      attacker: gameData.getFactionOwnedAbilityKeys(factions.attacker),
      defender: gameData.getFactionOwnedAbilityKeys(factions.defender),
    },
    nextCode: gen._nextCode,
  }
}
