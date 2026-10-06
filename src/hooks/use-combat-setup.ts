import { useMemo, useReducer, useState } from 'react'

import { CombatSetup } from '@/hooks/combat-setup'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'

import type { UnitEditorMode } from './combat-setup/combat-setup'

export function useCombatSetup(
  initialEditorMode: UnitEditorMode = 'SIMPLIFIED',
) {
  const [setup] = useState(() => new CombatSetup(initialEditorMode))
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const actions = useMemo(() => {
    /** Run a setup mutation, then re-render. */
    const act =
      <A extends unknown[]>(mutate: (...args: A) => void) =>
      (...args: A) => {
        mutate.apply(setup, args)
        forceRender()
      }
    return {
      setSystem: act(setup.setSystem),
      setFaction: act(setup.setFaction),
      setUnitCount: act(setup.setUnitCount),
      setUpgraded: act(setup.setUpgraded),
      setAbilityParam: act(setup.setAbilityParam),
      setCombatMode: act(setup.setCombatMode),
      setEditorMode: act(setup.setEditorMode),
      selectPlanet: act(setup.selectPlanet),
      addPlanet: act(setup.addPlanet),
      removePlanet: act(setup.removePlanet),
      reorderPlanets: act(setup.reorderPlanets),
      setSurfaceUnitCount: act(setup.setSurfaceUnitCount),
      resetUnits: act(setup.resetUnits),
      resetAbilities: act(setup.resetAbilities),
      swap: act(setup.swap),
      loadConfig: (config: SerializedConfig) => {
        setup.loadConfig(config)
        forceRender()
        return setup.editorMode
      },
    }
  }, [setup])

  const { stateData } = setup

  // Memoize to avoid new object reference every render —
  // useSimulation uses this as an effect dependency
  const simulationInput = useMemo(
    () => setup.toSimulationInput(),
    // oxlint-disable-next-line react/exhaustive-deps
    [stateData],
  )

  const serializedConfig = useMemo(
    () => setup.toSerializedConfig(),
    // oxlint-disable-next-line react/exhaustive-deps
    [stateData],
  )

  return {
    system: setup.system,
    attackerFaction: setup.attackerFaction,
    defenderFaction: setup.defenderFaction,
    attackerSelections: setup.attackerSelections,
    defenderSelections: setup.defenderSelections,
    combatMode: setup.combatMode,
    editorMode: setup.editorMode,
    surfaces: setup.surfaces,
    selectedPlanetId: setup.selectedPlanetId,
    surfaceSelections: setup.surfaceSelections,
    abilities: setup.abilities,
    attackerConfig: setup.getUnitConfig('attacker'),
    defenderConfig: setup.getUnitConfig('defender'),
    stateData,
    getReadContext: setup.getReadContext.bind(setup),
    getAvailableAbilities: setup.getAvailableAbilities.bind(setup),
    isUpgraded: setup.isUpgraded.bind(setup),
    simulationInput,
    serializedConfig,
    ...actions,
  }
}
