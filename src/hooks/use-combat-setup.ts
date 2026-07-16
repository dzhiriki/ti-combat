import { useCallback, useMemo, useReducer, useState } from 'react'

import type { CombatMode } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import type { CombatSide, FactionKey, GameSystem, UnitBaseType } from '@/types'

export function useCombatSetup() {
  const [setup] = useState(() => new CombatSetup())
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const setSystem = useCallback(
    (system: GameSystem) => {
      setup.setSystem(system)
      forceRender()
    },
    [setup],
  )

  const setFaction = useCallback(
    (side: CombatSide, faction: FactionKey) => {
      setup.setFaction(side, faction)
      forceRender()
    },
    [setup],
  )

  const setUnitCount = useCallback(
    (side: CombatSide, unitType: UnitBaseType, count: number) => {
      setup.setUnitCount(side, unitType, count)
      forceRender()
    },
    [setup],
  )

  const setUpgraded = useCallback(
    (side: CombatSide, unitType: UnitBaseType, upgraded: boolean) => {
      setup.setUpgraded(side, unitType, upgraded)
      forceRender()
    },
    [setup],
  )

  const setAbilityParam = useCallback(
    (side: CombatSide, abilityKey: string, params: Record<string, unknown>) => {
      setup.setAbilityParam(side, abilityKey, params)
      forceRender()
    },
    [setup],
  )

  const setCombatMode = useCallback(
    (mode: CombatMode) => {
      setup.setCombatMode(mode)
      forceRender()
    },
    [setup],
  )

  const resetUnits = useCallback(
    (side: CombatSide) => {
      setup.resetUnits(side)
      forceRender()
    },
    [setup],
  )

  const resetAbilities = useCallback(
    (side: CombatSide) => {
      setup.resetAbilities(side)
      forceRender()
    },
    [setup],
  )

  const swap = useCallback(() => {
    setup.swap()
    forceRender()
  }, [setup])

  const loadConfig = useCallback(
    (config: SerializedConfig) => {
      setup.loadConfig(config)
      forceRender()
    },
    [setup],
  )

  const { stateData } = setup

  // Memoize to avoid new object reference every render —
  // useSimulation uses this as an effect dependency
  const simulationInput = useMemo(
    () => setup.toSimulationInput(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateData],
  )

  const serializedConfig = useMemo(
    () => setup.toSerializedConfig(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateData],
  )

  const allAbilities = useMemo(() => getAllAbilities(), [])

  return {
    system: setup.system,
    attackerFaction: setup.attackerFaction,
    defenderFaction: setup.defenderFaction,
    attackerSelections: setup.attackerSelections,
    defenderSelections: setup.defenderSelections,
    combatMode: setup.combatMode,
    abilities: setup.abilities,
    stateData,
    getReadContext: setup.getReadContext.bind(setup),
    getAvailableAbilities: setup.getAvailableAbilities.bind(setup),
    isUpgraded: setup.isUpgraded.bind(setup),
    simulationInput,
    serializedConfig,
    allAbilities,
    setSystem,
    setFaction,
    setUnitCount,
    setUpgraded,
    setAbilityParam,
    setCombatMode,
    resetUnits,
    resetAbilities,
    swap,
    loadConfig,
  }
}
