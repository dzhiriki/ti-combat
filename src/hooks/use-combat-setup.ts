import { useCallback, useMemo, useReducer, useState } from 'react'

import type { CombatMode } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import type { CombatSide, GameSystem, SurfaceId, UnitBaseType } from '@/types'

import type { UnitEditorMode } from './combat-setup/combat-setup'

export function useCombatSetup(
  initialEditorMode: UnitEditorMode = 'SIMPLIFIED',
) {
  const [setup] = useState(() => new CombatSetup(initialEditorMode))
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const setSystem = useCallback(
    (system: GameSystem) => {
      setup.setSystem(system)
      forceRender()
    },
    [setup],
  )

  const setFaction = useCallback(
    (side: CombatSide, faction: string) => {
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

  const setEditorMode = useCallback(
    (mode: UnitEditorMode) => {
      setup.setEditorMode(mode)
      forceRender()
    },
    [setup],
  )

  const selectPlanet = useCallback(
    (surfaceId: SurfaceId) => {
      setup.selectPlanet(surfaceId)
      forceRender()
    },
    [setup],
  )

  const addPlanet = useCallback(() => {
    setup.addPlanet()
    forceRender()
  }, [setup])

  const removePlanet = useCallback(
    (surfaceId: SurfaceId) => {
      setup.removePlanet(surfaceId)
      forceRender()
    },
    [setup],
  )

  const setSurfaceUnitCount = useCallback(
    (
      side: CombatSide,
      surfaceId: SurfaceId,
      unitType: UnitBaseType,
      count: number,
    ) => {
      setup.setSurfaceUnitCount(side, surfaceId, unitType, count)
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
      return setup.editorMode
    },
    [setup],
  )

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
    stateData,
    getReadContext: setup.getReadContext.bind(setup),
    getAvailableAbilities: setup.getAvailableAbilities.bind(setup),
    isUpgraded: setup.isUpgraded.bind(setup),
    simulationInput,
    serializedConfig,
    setSystem,
    setFaction,
    setUnitCount,
    setUpgraded,
    setAbilityParam,
    setCombatMode,
    setEditorMode,
    selectPlanet,
    addPlanet,
    removePlanet,
    setSurfaceUnitCount,
    resetUnits,
    resetAbilities,
    swap,
    loadConfig,
  }
}
