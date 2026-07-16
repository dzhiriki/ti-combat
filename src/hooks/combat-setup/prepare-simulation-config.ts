import type { CombatSide, FactionKey, GameSystem } from '@/types'
import { getFactionSystem } from '@/utils/get-faction-system'

import type {
  Ability,
  RegisteredAbility,
} from '../../combat/abilities-engine/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
} from '../../combat/combat-state/types'
import {
  getAvailableAbilities,
  getFactionOwnedAbilityKeys,
  getUnitDefinitionAbilityKeys,
} from './get-available-abilities'
import {
  clampLimitParams,
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  resetSettingsToBase,
  restoreConsumerParams,
  snapshotConsumerParams,
} from './reconcile'

/**
 * Prepare abilities config for simulation.
 *
 * Runs the full reconcile pipeline (snapshot user params → reconcile →
 * restore user selections → reset SETTINGS to base), producing a config
 * ready for AbilitiesEngine with no further reconciliation needed.
 *
 * Returns the computed abilities so callers can pass them to CombatState
 * factories (avoiding a redundant second call to getAvailableAbilities).
 */
interface SideAbilitiesData {
  registered: RegisteredAbility[]
  unitAbilityKeys: ReadonlySet<string>
  factionOwnedKeys: ReadonlySet<string>
}

export function prepareSimulationConfig(
  config: Record<CombatSide, SideAbilitiesConfig>,
  attackerFaction: FactionKey,
  defenderFaction: FactionKey,
  combatMode: CombatMode,
  customAbilities?: Ability[],
): Record<CombatSide, SideAbilitiesData> {
  const custom = customAbilities ?? []
  // Custom abilities aren't tied to a slot — surface them as 'OTHER'
  // so they still flow through the registered pipeline.
  const customRegistered: RegisteredAbility[] = custom.map(ability => ({
    ability,
    slot: 'OTHER',
  }))
  // Both sides always share a game system. Neutral exists in every system,
  // so derive it from whichever side is non-neutral (mirrors the shared-link
  // restore logic in combat-setup.ts); all-neutral defaults to TI4.
  const system: GameSystem =
    getFactionSystem(attackerFaction) === 'TWILIGHTS_FALL' ||
    getFactionSystem(defenderFaction) === 'TWILIGHTS_FALL'
      ? 'TWILIGHTS_FALL'
      : 'TI4'
  const registered: Record<CombatSide, RegisteredAbility[]> = {
    attacker: [
      ...getAvailableAbilities('attacker', attackerFaction, undefined, system),
      ...customRegistered,
    ],
    defender: [
      ...getAvailableAbilities('defender', defenderFaction, undefined, system),
      ...customRegistered,
    ],
  }
  // `registered` may contain the same ability under multiple slots (own
  // faction's agents/commanders appear in both AGENT and FACTION_AGENT for
  // panel rendering). Reconciliation operates on a unique flat list.
  const flattenUnique = (regs: readonly RegisteredAbility[]): Ability[] => {
    const seen = new Set<string>()
    const out: Ability[] = []
    for (const r of regs) {
      if (seen.has(r.ability.key)) continue
      seen.add(r.ability.key)
      out.push(r.ability)
    }
    return out
  }
  const abilities: Record<CombatSide, Ability[]> = {
    attacker: flattenUnique(registered.attacker),
    defender: flattenUnique(registered.defender),
  }

  const savedParams = snapshotConsumerParams(config, abilities)
  // Materialize every registered ability's static defaults into the config so
  // `sideData.abilities` carries a base entry for all of them (uses, isEnabled,
  // and simple defaults). Runs AFTER the snapshot so it only fills gaps —
  // snapshot/restore must not capture these defaults and overwrite reconciled
  // sync values. Mirrors the UI store's setup (combat-setup.ts).
  initializeAbilityDefaults(config, abilities)
  reconcileAbilitiesConfig(config, abilities, combatMode)
  restoreConsumerParams(config, abilities, savedParams)
  // After restore, sync-source params with declared limits may carry
  // user-supplied values that exceed the cap. Clamp them in place without
  // re-expanding the valid list so that order-mode params (single-element
  // tuples) and user-trimmed lists are not affected.
  clampLimitParams(config, abilities)
  resetSettingsToBase(config, abilities)

  return {
    attacker: {
      registered: registered.attacker,
      unitAbilityKeys: getUnitDefinitionAbilityKeys(attackerFaction),
      factionOwnedKeys: getFactionOwnedAbilityKeys(attackerFaction),
    },
    defender: {
      registered: registered.defender,
      unitAbilityKeys: getUnitDefinitionAbilityKeys(defenderFaction),
      factionOwnedKeys: getFactionOwnedAbilityKeys(defenderFaction),
    },
  }
}
