import { describe, expect, it } from 'vitest'

import { cloneStateForBranch, CombatEngine, CombatSideState } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import type { SurfaceDefinition, SurfaceId, UnitId } from '@/types'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from './utils/combat-test'
import { getSurfaceUnitIds } from './utils/surface-units'

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
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].CRUISER).toBe(1)
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].INFANTRY).toBe(2)
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].DREADNOUGHT).toBe(
      1,
    )
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].INFANTRY).toBe(3)
    expect(input.defenderPlacements.counts[PLANET_1].PDS).toBe(1)
  })

  it('places space-capable structures in space during simplified space combat', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'RAL_NEL')
    setup.setFaction('defender', 'RAL_NEL')
    setup.setUnitCount('attacker', 'PDS', 1)
    setup.setUnitCount('defender', 'SPACE_DOCK', 1)

    let input = setup.toSimulationInput()!
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].PDS).toBe(1)
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].SPACE_DOCK).toBe(1)
    expect(input.attackerPlacements.counts[PLANET_1].PDS).toBe(0)
    expect(input.defenderPlacements.counts[PLANET_1].SPACE_DOCK).toBe(0)

    setup.setCombatMode('GROUND')
    input = setup.toSimulationInput()!
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].PDS).toBe(0)
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].SPACE_DOCK).toBe(0)
    expect(input.attackerPlacements.counts[PLANET_1].PDS).toBe(1)
    expect(input.defenderPlacements.counts[PLANET_1].SPACE_DOCK).toBe(1)
  })

  it('places both sides ground forces on the planet for ground combat', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('attacker', 'INFANTRY', 2)
    setup.setUnitCount('defender', 'DREADNOUGHT', 1)
    setup.setUnitCount('defender', 'MECH', 3)

    setup.setCombatMode('GROUND')

    const input = setup.toSimulationInput()!
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].CRUISER).toBe(1)
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].DREADNOUGHT).toBe(
      1,
    )
    expect(input.attackerPlacements.counts[PLANET_1].INFANTRY).toBe(2)
    expect(input.defenderPlacements.counts[PLANET_1].MECH).toBe(3)
    expect(input.attackerPlacements.counts[SPACE_SURFACE_ID].INFANTRY).toBe(0)
    expect(input.defenderPlacements.counts[SPACE_SURFACE_ID].MECH).toBe(0)

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

  it('preserves planet placements while switching full-mode tabs', () => {
    const setup = new CombatSetup('FULL')
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 2)
    setup.addPlanet()
    setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 3)
    setup.selectPlanet(PLANET_1)

    expect(setup.defenderSelections.INFANTRY.count).toBe(2)
    expect(setup.surfaceSelections.defender[PLANET_1].INFANTRY.count).toBe(2)
    expect(setup.surfaceSelections.defender[PLANET_2].INFANTRY.count).toBe(3)
  })

  it('shares upgrades and enforces unit limits across surfaces', () => {
    const setup = new CombatSetup('FULL')
    setup.addPlanet()
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

  it('collapses all planets when switching from Full to Simple', () => {
    const setup = new CombatSetup('FULL')
    setup.setSurfaceUnitCount('attacker', PLANET_1, 'INFANTRY', 2)
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', PLANET_2, 'INFANTRY', 3)
    setup.setUpgraded('attacker', 'MECH', true)
    setup.setEditorMode('SIMPLIFIED')
    expect(setup.surfaces).toHaveLength(2)
    expect(setup.attackerSelections.INFANTRY.count).toBe(5)
    expect(setup.isUpgraded('attacker', 'MECH')).toBe(true)
    expect(
      setup.toSimulationInput()!.attackerPlacements.counts[SPACE_SURFACE_ID]
        .INFANTRY,
    ).toBe(5)
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
    const setup = new CombatSetup('FULL')
    setup.addPlanet()
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

    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      0,
    )
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(1)
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
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(0)
  })

  it('commits units before ending after a bombardment wipe', () => {
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

    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(0)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(1)
    expect(t.state.winnerSide).toBe('attacker')
    expect(t.isFinished()).toBe(true)
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

    const id = getSurfaceUnitIds(
      inSpace.data.attacker,
      SPACE_SURFACE_ID,
    )[0] as UnitId
    CombatSideState.modifyUnitState(inSpace.data.attacker, id, {
      isDamaged: true,
    })
    CombatSideState.moveUnits(inSpace.data.attacker, [id], PLANET_2)
    expect(getSurfaceUnitIds(inSpace.data.attacker, PLANET_2)).toEqual([id])
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
    const id = getSurfaceUnitIds(
      state.data.attacker,
      SPACE_SURFACE_ID,
    )[0] as UnitId

    const moved = cloneStateForBranch(state.data)
    CombatSideState.moveUnits(moved.attacker, [id], PLANET_1)
    expect(getSurfaceUnitIds(moved.attacker, PLANET_1)).toEqual([id])
    expect(getSurfaceUnitIds(state.data.attacker, SPACE_SURFACE_ID)).toEqual([
      id,
    ])

    const casualty = cloneStateForBranch(state.data)
    CombatSideState.removeUnits(casualty.attacker, id)
    expect(getSurfaceUnitIds(casualty.attacker, SPACE_SURFACE_ID)).toHaveLength(
      0,
    )
    expect(getSurfaceUnitIds(state.data.attacker, SPACE_SURFACE_ID)).toEqual([
      id,
    ])
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

    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(0)
    const remoteMech = getSurfaceUnitIds(
      t.state.defender,
      PLANET_1,
    )[0] as UnitId
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

    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      1,
    )
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.attacker, PLANET_2)).toHaveLength(0)
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
        normal.data,
        { PDS: 1 },
        SPACE_SURFACE_ID,
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
      saar.data,
      { SPACE_DOCK: 1 },
      SPACE_SURFACE_ID,
    )
    expect(
      getSurfaceUnitIds(saar.data.attacker, SPACE_SURFACE_ID),
    ).toHaveLength(1)
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

describe('per-surface outcome probabilities', () => {
  it('preserves an off-combat planet in every probabilistic outcome', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'GROUND',
      surfaces: SURFACES,
      activeSurfaceId: PLANET_2,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_2]: { INFANTRY: 1 } },
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
    const outcomes = new CombatEngine().simulate(state)
    expect(outcomes.length).toBeGreaterThan(1)
    expect(outcomes.reduce((sum, o) => sum + o.probability, 0)).toBeCloseTo(
      1,
      10,
    )
    expect(
      outcomes.reduce(
        (sum, o) =>
          sum +
          (o.defenderSurfaces[PLANET_1].INFANTRY?.length === 1
            ? o.probability
            : 0),
        0,
      ),
    ).toBeCloseTo(1, 10)
    for (const outcome of outcomes) {
      expect(Object.keys(outcome.defenderSurfaces)).toEqual(
        SURFACES.map(s => s.id),
      )
      expect(outcome.defender.INFANTRY?.length).toBe(
        (outcome.defenderSurfaces[PLANET_1].INFANTRY?.length ?? 0) +
          (outcome.defenderSurfaces[PLANET_2].INFANTRY?.length ?? 0),
      )
    }
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

    const remote = getSurfaceUnitIds(t.state.attacker, PLANET_1)
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
    const mech = getSurfaceUnitIds(t.state.attacker, PLANET_1)[0] as UnitId
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

    expect(getSurfaceUnitIds(t.state.defender, SPACE_SURFACE_ID)).toHaveLength(
      0,
    )
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(0)
    expect(getSurfaceUnitIds(t.state.defender, PLANET_2)).toHaveLength(0)
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

    const remote = getSurfaceUnitIds(t.state.attacker, PLANET_1)[0]
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
    const mech = getSurfaceUnitIds(t.state.attacker, PLANET_1)[0]
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
    expect(getSurfaceUnitIds(t.state.defender, PLANET_1)).toHaveLength(0)
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
    const mech = getSurfaceUnitIds(t.state.attacker, PLANET_1)[0] as UnitId
    t.state.attacker.unitState[mech] = { isDamaged: true }

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'GROUND_COMBAT')

    expect(t.abilityLog('TF_STARLANCER_II')).not.toHaveLength(0)
    expect(t.state.attacker.unitState[mech]?.isDamaged).not.toBe(true)
  })
})
