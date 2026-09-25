import { createLookups } from '@/combat'
import type {
  CollectedAbility,
  CombatSide,
  GameSystem,
  SideUnitPlacements,
  SurfaceDefinition,
  SurfaceId,
} from '@/types'
import { getGameData } from '@/utils/get-game-data'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import type { Ability } from '../../combat/abilities-engine/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
} from '../../combat/combat-state/types'
import { buildSideState } from './build-side-state'
import {
  clampLimitParams,
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  restoreConsumerParams,
  snapshotConsumerParams,
} from './reconcile'

/**
 * Prepare abilities config for simulation.
 *
 * Runs the full reconcile pipeline (snapshot user params → reconcile →
 * restore user selections), producing a config
 * ready for AbilitiesEngine with no further reconciliation needed.
 *
 * Returns the computed abilities so callers can pass them to CombatState
 * factories (avoiding a redundant second call to getAvailableAbilities).
 */
interface SideAbilitiesData {
  registered: CollectedAbility[]
  unitAbilityKeys: ReadonlySet<string>
  factionOwnedKeys: ReadonlySet<string>
  metadata: import('./reconcile').SideOptionMetadata
}

export function prepareSimulationConfig(
  system: GameSystem,
  config: Record<CombatSide, SideAbilitiesConfig>,
  attackerFaction: string,
  defenderFaction: string,
  combatMode: CombatMode,
  customAbilities?: Ability[],
  placementContext?: {
    surfaces: readonly SurfaceDefinition[]
    activeSurfaceId: SurfaceId
    attacker: SideUnitPlacements
    defender: SideUnitPlacements
  },
): Record<CombatSide, SideAbilitiesData> {
  const gameData = getGameData(system)
  const custom = customAbilities ?? []
  // Custom abilities (tests, ad-hoc probes) aren't collected from any slot
  // config and never reach the panel; file them under OTHER so they flow
  // through the same registered pipeline.
  const customRegistered: CollectedAbility[] = custom.map(ability => ({
    ...ability,
    slot: 'OTHER',
  }))
  const registered: Record<CombatSide, CollectedAbility[]> = {
    attacker: [
      ...gameData.getAvailableAbilities(
        'attacker',
        attackerFaction,
        new Set(placementContext?.attacker.upgradedTypes ?? []),
      ),
      ...customRegistered,
    ],
    defender: [
      ...gameData.getAvailableAbilities(
        'defender',
        defenderFaction,
        new Set(placementContext?.defender.upgradedTypes ?? []),
      ),
      ...customRegistered,
    ],
  }
  const lookups = createLookups(registered)

  const savedParams = snapshotConsumerParams(config, registered)
  // Materialize every registered ability's static defaults into the config so
  // `sideData.abilities` carries a base entry for all of them (uses, isEnabled,
  // and simple defaults). Runs AFTER the snapshot so it only fills gaps —
  // snapshot/restore must not capture these defaults and overwrite reconciled
  // sync values. Mirrors the UI store's setup (combat-setup.ts).
  initializeAbilityDefaults(config, registered)
  const placementState = placementContext
    ? (() => {
        const gen: { _nextCode?: number } = {}
        return {
          attacker: buildSideState(
            system,
            attackerFaction,
            placementContext.attacker,
            placementContext.surfaces,
            config.attacker,
            registered.attacker,
            gen,
          ),
          defender: buildSideState(
            system,
            defenderFaction,
            placementContext.defender,
            placementContext.surfaces,
            config.defender,
            registered.defender,
            gen,
          ),
          surfaces: [...placementContext.surfaces],
          activeSurfaceId: placementContext.activeSurfaceId,
          combatMode,
        }
      })()
    : undefined
  const metadata = reconcileAbilitiesConfig(
    config,
    registered,
    combatMode,
    placementState,
    lookups,
    {
      attacker:
        placementState?.attacker.unitStats ??
        buildUnitStatsMap(system, attackerFaction),
      defender:
        placementState?.defender.unitStats ??
        buildUnitStatsMap(system, defenderFaction),
    },
  )
  restoreConsumerParams(config, registered, savedParams)
  // After restore, sync-source params with declared limits may carry
  // user-supplied values that exceed the cap. Clamp them in place without
  // re-expanding the valid list so that order-mode params (single-element
  // tuples) and user-trimmed lists are not affected.
  clampLimitParams(config, registered)
  return {
    attacker: {
      registered: registered.attacker,
      unitAbilityKeys: gameData.getUnitDefinitionAbilityKeys(attackerFaction),
      factionOwnedKeys: gameData.getFactionOwnedAbilityKeys(attackerFaction),
      metadata: metadata.attacker,
    },
    defender: {
      registered: registered.defender,
      unitAbilityKeys: gameData.getUnitDefinitionAbilityKeys(defenderFaction),
      factionOwnedKeys: gameData.getFactionOwnedAbilityKeys(defenderFaction),
      metadata: metadata.defender,
    },
  }
}
