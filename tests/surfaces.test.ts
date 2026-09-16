import { describe, expect, it } from 'vitest'

import { cloneStateForBranch, CombatEngine, CombatSideState } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import type { SurfaceDefinition, SurfaceId, UnitId } from '@/types'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from './utils/combat-test'

const PLANET_1 = 'planet-1' as SurfaceId
const PLANET_2 = 'planet-2' as SurfaceId
const SURFACES: SurfaceDefinition[] = [
  { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
  { id: PLANET_1, type: 'PLANET', name: 'Planet 1' },
  { id: PLANET_2, type: 'PLANET', name: 'Planet 2' },
]

describe('surface editor conversion', () => {
  it('places both sides ships and ground forces in space for space combat', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('attacker', 'INFANTRY', 2)
    setup.setUnitCount('defender', 'DREADNOUGHT', 1)
    setup.setUnitCount('defender', 'INFANTRY', 3)
    setup.setUnitCount('defender', 'PDS', 1)

    const input = setup.toSimulationInput()!
    expect(input.attackerPlacements[SPACE_SURFACE_ID].CRUISER.count).toBe(1)
    expect(input.attackerPlacements[SPACE_SURFACE_ID].INFANTRY.count).toBe(2)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].DREADNOUGHT.count).toBe(1)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].INFANTRY.count).toBe(3)
    expect(input.defenderPlacements[PLANET_1].PDS.count).toBe(1)
  })

  it('places space-capable structures in space during simplified space combat', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'RAL_NEL')
    setup.setFaction('defender', 'RAL_NEL')
    setup.setUnitCount('attacker', 'PDS', 1)
    setup.setUnitCount('defender', 'SPACE_DOCK', 1)

    let input = setup.toSimulationInput()!
    expect(input.attackerPlacements[SPACE_SURFACE_ID].PDS.count).toBe(1)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].SPACE_DOCK.count).toBe(1)
    expect(input.attackerPlacements[PLANET_1].PDS.count).toBe(0)
    expect(input.defenderPlacements[PLANET_1].SPACE_DOCK.count).toBe(0)

    setup.setCombatMode('GROUND')
    input = setup.toSimulationInput()!
    expect(input.attackerPlacements[SPACE_SURFACE_ID].PDS.count).toBe(0)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].SPACE_DOCK.count).toBe(0)
    expect(input.attackerPlacements[PLANET_1].PDS.count).toBe(1)
    expect(input.defenderPlacements[PLANET_1].SPACE_DOCK.count).toBe(1)
  })

  it('places both sides ground forces on the planet for ground combat', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('attacker', 'INFANTRY', 2)
    setup.setUnitCount('defender', 'DREADNOUGHT', 1)
    setup.setUnitCount('defender', 'MECH', 3)

    setup.setCombatMode('GROUND')

    const input = setup.toSimulationInput()!
    expect(input.attackerPlacements[SPACE_SURFACE_ID].CRUISER.count).toBe(1)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].DREADNOUGHT.count).toBe(1)
    expect(input.attackerPlacements[PLANET_1].INFANTRY.count).toBe(2)
    expect(input.defenderPlacements[PLANET_1].MECH.count).toBe(3)
    expect(input.attackerPlacements[SPACE_SURFACE_ID].INFANTRY.count).toBe(0)
    expect(input.defenderPlacements[SPACE_SURFACE_ID].MECH.count).toBe(0)

    expect(setup.surfaceSelections.attacker[PLANET_1].INFANTRY.count).toBe(2)
    expect(setup.surfaceSelections.defender[PLANET_1].MECH.count).toBe(3)

    setup.setCombatMode('SPACE')

    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].INFANTRY.count,
    ).toBe(2)
    expect(setup.surfaceSelections.defender[SPACE_SURFACE_ID].MECH.count).toBe(
      3,
    )
    expect(setup.surfaceSelections.attacker[PLANET_1].INFANTRY.count).toBe(0)
    expect(setup.surfaceSelections.defender[PLANET_1].MECH.count).toBe(0)
  })

  it('preserves hidden planets while switching tabs in simplified mode', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('defender', 'INFANTRY', 2)
    setup.addPlanet()
    setup.setUnitCount('defender', 'INFANTRY', 3)
    setup.selectPlanet(PLANET_1)

    expect(setup.defenderSelections.INFANTRY.count).toBe(2)
    setup.setEditorMode('FULL')
    expect(setup.surfaceSelections.defender[PLANET_1].INFANTRY.count).toBe(2)
    expect(setup.surfaceSelections.defender[PLANET_2].INFANTRY.count).toBe(3)
  })

  it('shares upgrades and enforces unit limits across surfaces', () => {
    const setup = new CombatSetup()
    setup.addPlanet()
    setup.setEditorMode('FULL')
    setup.setSurfaceUnitCount('attacker', PLANET_1, 'MECH', 4)
    setup.setSurfaceUnitCount('attacker', PLANET_2, 'MECH', 4)
    setup.setUpgraded('attacker', 'MECH', true)

    const placements = setup.surfaceSelections.attacker
    expect(
      placements[PLANET_1].MECH.count + placements[PLANET_2].MECH.count,
    ).toBe(4)
    expect(placements[PLANET_1].MECH.upgraded).toBe(true)
    expect(placements[PLANET_2].MECH.upgraded).toBe(true)
  })

  it('relocates a faction unit when its placement becomes illegal', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'CLAN_OF_SAAR')
    setup.setEditorMode('FULL')
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'SPACE_DOCK', 1)
    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].SPACE_DOCK.count,
    ).toBe(1)

    setup.setFaction('attacker', 'FEDERATION_OF_SOL')
    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].SPACE_DOCK.count,
    ).toBe(0)
    expect(setup.surfaceSelections.attacker[PLANET_1].SPACE_DOCK.count).toBe(1)
  })

  it('roundtrips full placements, planets, and the selected tab', () => {
    const setup = new CombatSetup()
    setup.addPlanet()
    setup.setEditorMode('FULL')
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 2)
    setup.setSurfaceUnitCount('defender', PLANET_2, 'MECH', 1)

    const restored = new CombatSetup()
    restored.loadConfig(setup.toSerializedConfig())

    expect(restored.editorMode).toBe('FULL')
    expect(restored.selectedPlanetId).toBe(PLANET_2)
    expect(restored.surfaces.filter(s => s.type === 'PLANET')).toHaveLength(2)
    expect(restored.surfaceSelections.defender[PLANET_1].INFANTRY.count).toBe(2)
    expect(restored.surfaceSelections.defender[PLANET_2].MECH.count).toBe(1)
  })

  it('retains one planet and removes only empty additional planets', () => {
    const setup = new CombatSetup()
    setup.removePlanet(PLANET_1)
    expect(
      setup.surfaces.filter(surface => surface.type === 'PLANET'),
    ).toHaveLength(1)

    setup.addPlanet()
    setup.setEditorMode('FULL')
    setup.setSurfaceUnitCount('attacker', PLANET_2, 'INFANTRY', 1)
    setup.removePlanet(PLANET_2)
    expect(setup.surfaces.some(surface => surface.id === PLANET_2)).toBe(true)

    setup.setSurfaceUnitCount('attacker', PLANET_2, 'INFANTRY', 0)
    setup.removePlanet(PLANET_2)
    expect(setup.surfaces.some(surface => surface.id === PLANET_2)).toBe(false)
  })
})

describe('surface combat behavior', () => {
  it('commits eligible attackers from space to the selected planet only', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { INFANTRY: 1 },
          [PLANET_1]: { INFANTRY: 1 },
        },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    expect(t.state.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(0)
    expect(t.state.attacker.surfaceUnits[PLANET_1]).toHaveLength(1)
    expect(t.state.attacker.surfaceUnits[PLANET_2]).toHaveLength(1)
    expect(t.state.attacker.participatingUnits).toHaveLength(1)
  })

  it('ends combat without treating units on another planet as participants', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 1 } },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 1 })

    expect(t.state.winnerSide).toBe('attacker')
    expect(t.state.defender.surfaceUnits[PLANET_1]).toHaveLength(1)
    expect(t.state.defender.surfaceUnits[PLANET_2]).toHaveLength(0)
  })

  it('continues through commitment after bombardment wipes the planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DREADNOUGHT: 1, INFANTRY: 1 },
        },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 0, defender: 1 })

    expect(t.state.defender.surfaceUnits[PLANET_2]).toHaveLength(0)
    expect(t.state.attacker.surfaceUnits[PLANET_2]).toHaveLength(1)
    expect(t.state.winnerSide).toBeUndefined()
    t.advanceRound()
    expect(t.state.winnerSide).toBe('attacker')
  })

  it('includes location in state hashes and preserves identity when moving', () => {
    const makeState = (surfaceId: SurfaceId) =>
      buildCombatState({
        system: 'TI4',
        mode: 'GROUND',
        surfaces: SURFACES,
        activeSurfaceId: PLANET_2,
        attacker: {
          faction: 'FEDERATION_OF_SOL',
          units: {},
          placements: { [surfaceId]: { INFANTRY: 1 } },
        },
        defender: { faction: 'FEDERATION_OF_SOL', units: {} },
      })

    const inSpace = makeState(SPACE_SURFACE_ID)
    const onPlanet = makeState(PLANET_1)
    expect(inSpace.getHash()).not.toBe(onPlanet.getHash())

    const id = inSpace.data.attacker.surfaceUnits[SPACE_SURFACE_ID][0] as UnitId
    CombatSideState.modifyUnitState(inSpace.data.attacker, id, {
      isDamaged: true,
    })
    CombatSideState.moveUnits(inSpace.data.attacker, [id], PLANET_2)
    expect(inSpace.data.attacker.surfaceUnits[PLANET_2]).toBe(id)
    expect(inSpace.data.attacker.unitState[id].isDamaged).toBe(true)
  })

  it('isolates movement and casualties between simulation branches', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { CRUISER: 1 } },
      },
      defender: { faction: 'FEDERATION_OF_SOL', units: {} },
    })
    const id = state.data.attacker.surfaceUnits[SPACE_SURFACE_ID][0] as UnitId

    const moved = cloneStateForBranch(state.data)
    CombatSideState.moveUnits(moved.attacker, [id], PLANET_1)
    expect(moved.attacker.surfaceUnits[PLANET_1]).toBe(id)
    expect(state.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toBe(id)

    const casualty = cloneStateForBranch(state.data)
    CombatSideState.removeUnits(casualty.attacker, id)
    expect(casualty.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(0)
    expect(state.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toBe(id)
  })

  it('does not let a remote mech sustain hits for the selected planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 1 } },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 1 })

    expect(t.state.defender.surfaceUnits[PLANET_1]).toHaveLength(1)
    expect(t.state.defender.surfaceUnits[PLANET_2]).toHaveLength(0)
    const remoteMech = t.state.defender.surfaceUnits[PLANET_1][0] as UnitId
    expect(t.state.defender.unitState[remoteMech]?.isDamaged).not.toBe(true)
  })

  it('restores retreated units to their original surface', () => {
    const t = combatTest({
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [PLANET_1]: { INFANTRY: 1 },
        },
        abilities: { RETREAT: { isEnabled: true, rounds: 1 } },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { CRUISER: 1 } },
      },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(1)
    expect(t.state.attacker.surfaceUnits[PLANET_1]).toHaveLength(1)
    expect(t.state.attacker.surfaceUnits[PLANET_2]).toHaveLength(0)
  })

  it('enforces placement permissions with faction overrides', () => {
    const normal = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: { faction: 'FEDERATION_OF_SOL', units: {} },
      defender: { faction: 'FEDERATION_OF_SOL', units: {} },
    })
    expect(() =>
      CombatSideState.placeUnits(
        normal.data.attacker,
        'SPACE',
        { PDS: 1 },
        SPACE_SURFACE_ID,
        normal.data,
      ),
    ).toThrow('PDS cannot be placed on SPACE')

    const saar = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: { faction: 'CLAN_OF_SAAR', units: {} },
      defender: { faction: 'FEDERATION_OF_SOL', units: {} },
    })
    CombatSideState.placeUnits(
      saar.data.attacker,
      'SPACE',
      { SPACE_DOCK: 1 },
      SPACE_SURFACE_ID,
      saar.data,
    )
    expect(saar.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(1)
  })

  it('returns survivors grouped by surface', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { INFANTRY: 1 } },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_1]: { INFANTRY: 1 } },
      },
    })

    const [outcome] = new CombatEngine().simulate(state)
    expect(outcome.winner).toBe('attacker')
    expect(outcome.attackerSurfaces[PLANET_2].INFANTRY).toHaveLength(1)
    expect(outcome.defenderSurfaces[PLANET_1].INFANTRY).toHaveLength(1)
  })
})

describe('multi-surface ability behavior', () => {
  it('A3 Valiance galvanizes infantry on another planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'LAST_BASTION',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 3 },
          [PLANET_2]: { MECH: 1 },
        },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 3,
          },
          SUSTAIN_DAMAGE: { groundPriority: [['MECH:Galvanized', true]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 4 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    const remote = t.state.attacker.surfaceUnits[PLANET_1]
    expect(remote).toHaveLength(3)
    expect(
      [...remote].every(id =>
        t.state.attacker.unitType[id].includes('Galvanized'),
      ),
    ).toBe(true)
  })

  it('Emergency Repairs repairs a damaged unit on another planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
      },
    })
    const mech = t.state.attacker.surfaceUnits[PLANET_1][0] as UnitId
    t.state.attacker.unitState[mech] = { isDamaged: true }

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.state.attacker.unitState[mech]?.isDamaged).not.toBe(true)
  })

  it('Apollo rolls against opponent units on every surface', () => {
    const t = combatTest({
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'LAST_BASTION',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { CRUISER: 1 } },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [PLANET_1]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    expect(t.step()).toHaveLength(4)
  })

  it('Atomize destroys non-ship units on other surfaces', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'AVARICE_REX',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { FLAGSHIP: 1 } },
        abilities: { TF_ATOMIZE: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 2 },
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { PDS: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.state.defender.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(0)
    expect(t.state.defender.surfaceUnits[PLANET_1]).toHaveLength(0)
    expect(t.state.defender.surfaceUnits[PLANET_2]).toHaveLength(0)
  })

  it('Dame Briar galvanizes a surviving unit on another planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'LAST_BASTION',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
        abilities: {
          DAME_BRIAR: { isEnabled: true, groundUnitType: 'INFANTRY' },
          PRE_GALVANIZED: { reinforcementTokens: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 2 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    const remote = t.state.attacker.surfaceUnits[PLANET_1][0]
    expect(t.state.attacker.unitType[remote]).toContain('Galvanized')
  })

  it('Evelyn DeLouis does not select a non-participating ground force on another planet', () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
        abilities: {
          EVELYN_DELOUIS: { isEnabled: true, unitType: 'MECH' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'GROUND_COMBAT')

    expect(t.abilityLog('EVELYN_DELOUIS')).toHaveLength(0)
    const mech = t.state.attacker.surfaceUnits[PLANET_1][0]
    expect(t.state.attacker.unitType[mech]).not.toContain('Evelyn')
  })

  it('Intelligence Unshackled rolls against units on every surface', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'AVARICE_REX',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { CRUISER: 1 } },
        abilities: { TF_INTELLIGENCE_UNSHACKLED: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [PLANET_1]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    expect(t.step()).toHaveLength(4)
  })

  it('Lash can destroy a non-participant on another surface', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'AVARICE_REX',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { CRUISER: 1 } },
        abilities: {
          TF_LASH: {
            isEnabled: true,
            spaceTargetPriority: [['INFANTRY', true]],
          },
        },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [PLANET_1]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).not.toHaveLength(0)
    expect(t.state.defender.surfaceUnits[PLANET_1]).toHaveLength(0)
  })

  it("Moyin's Ashes counts mechs on other planets", () => {
    const t = combatTest({
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 4 },
          [PLANET_2]: { INFANTRY: 2 },
        },
        abilities: { INDOCTRINATION: true, MOYINS_ASHES: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 3 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('MOYINS_ASHES')).toHaveLength(0)
    expect(t.attacker.units.MECH).toHaveLength(4)
  })

  it('Starlancer II repairs mechs on another planet', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'RADIANT_AUR',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
        abilities: { TF_STARLANCER_II: { uses: 1 } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
      },
    })
    const mech = t.state.attacker.surfaceUnits[PLANET_1][0] as UnitId
    t.state.attacker.unitState[mech] = { isDamaged: true }

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'GROUND_COMBAT')

    expect(t.abilityLog('TF_STARLANCER_II')).not.toHaveLength(0)
    expect(t.state.attacker.unitState[mech]?.isDamaged).not.toBe(true)
  })
})
