import { prepareSimulationConfig } from '@/hooks/combat-setup'
import { buildSideState } from '@/hooks/combat-setup/build-side-state'
import type { SimulationInput } from '@/hooks/combat-setup/types'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'

self.onmessage = (e: MessageEvent<SimulationInput>) => {
  const {
    system,
    attackerFaction,
    defenderFaction,
    surfaces,
    activeSurfaceId,
    attackerPlacements,
    defenderPlacements,
    combatMode,
    abilities,
    precision,
  } = e.data

  const collapseThreshold =
    precision?.kind === 'limited' ? 10 ** -precision.digits : undefined

  const sideAbilities = prepareSimulationConfig(
    system,
    abilities,
    attackerFaction,
    defenderFaction,
    combatMode,
    undefined,
    {
      surfaces,
      activeSurfaceId,
      attacker: attackerPlacements,
      defender: defenderPlacements,
    },
  )
  const gen: { _nextCode?: number } = {}
  const combatState = CombatState.forSimulation(
    buildSideState(
      system,
      attackerFaction,
      attackerPlacements,
      surfaces,
      abilities.attacker,
      sideAbilities.attacker.registered,
      gen,
      sideAbilities.attacker.metadata.subtypes,
      sideAbilities.attacker.metadata.categories,
    ),
    buildSideState(
      system,
      defenderFaction,
      defenderPlacements,
      surfaces,
      abilities.defender,
      sideAbilities.defender.registered,
      gen,
      sideAbilities.defender.metadata.subtypes,
      sideAbilities.defender.metadata.categories,
    ),
    combatMode,
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
    collapseThreshold,
  )

  const engine = new CombatEngine({
    logStats: true,
  })
  console.time('Simulate')
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)

  self.postMessage(outcomes)
}
