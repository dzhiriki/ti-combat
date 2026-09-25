import { describe, expect, it, vi } from 'vitest'

import {
  CombatEngine,
  CombatSideState,
  extractSyncSources,
  makeUnitLocator,
  withRunningAbility,
} from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import {
  labelUnitOptions,
  groupUnitOptions,
} from '@/components/abilities-panel/components/unit-option-presentation'
import { SHIPS } from '@/constants/units'
import { CombatSetup } from '@/hooks/combat-setup'
import type { SimulationInput } from '@/hooks/combat-setup/types'
import { validateSerializedConfig } from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'
import type {
  CombatSide,
  SurfaceDefinition,
  SurfaceId,
  UnitBaseType,
  UnitId,
  UnitLocator,
  UnitType,
} from '@/types'
import { SPACE_SURFACE_ID, UnitListSchema } from '@/types'

import { combatTest } from './utils/combat-test'
import { getSurfaceUnitIds } from './utils/surface-units'

const SPACE = SPACE_SURFACE_ID
const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId
const SURFACES: SurfaceDefinition[] = [
  { id: SPACE, type: 'SPACE', name: 'Space' },
  { id: P1, type: 'PLANET', name: 'Planet 1' },
  { id: P2, type: 'PLANET', name: 'Planet 2' },
]
const target = (
  type: UnitType | `${UnitBaseType}:${string}`,
  surface: SurfaceId,
) => makeUnitLocator(type as UnitType, surface)

function setupWithAlastor() {
  const setup = new CombatSetup('FULL')
  setup.setFaction('attacker', 'NEKRO_VIRUS')
  setup.addPlanet()
  setup.setSurfaceUnitCount('attacker', SPACE, 'FLAGSHIP', 1)
  for (const surface of [SPACE, P1, P2])
    setup.setSurfaceUnitCount('attacker', surface, 'INFANTRY', 2)
  setup.setSurfaceUnitCount('attacker', P1, 'MECH', 1)
  setup.setSurfaceUnitCount('attacker', P2, 'MECH', 1)
  setup.setSurfaceUnitCount('attacker', P2, 'PDS', 1)
  return setup
}

function options(
  setup: CombatSetup,
  abilityKey: string,
  param: string,
  side: CombatSide = 'attacker',
) {
  const ability = setup
    .getAvailableAbilities(side)
    .find(item => item.key === abilityKey)!
  const ctx = setup.getReadContext(side)
  const spec = extractSyncSources(ability)?.find(item => item.key === param)
  return withRunningAbility(ctx, ability, () =>
    ctx.api[spec?.side ?? 'own'].getUnitVariantsOptions(param),
  )
}

function keys(
  setup: CombatSetup,
  ability: string,
  param: string,
): UnitLocator[] {
  return (setup.abilities.attacker[ability][param] as [UnitLocator][]).map(
    ([key]) => key,
  )
}

function alastorCombat(
  abilities: Record<string, true | false | Record<string, unknown>>,
  ground: Record<string, Partial<Record<'INFANTRY' | 'MECH', number>>> = {
    [P1]: { INFANTRY: 1 },
    [P2]: { INFANTRY: 1 },
  },
) {
  return combatTest({
    mode: 'SPACE',
    surfaces: SURFACES,
    attacker: {
      faction: 'NEKRO_VIRUS',
      units: {},
      placements: { [SPACE]: { FLAGSHIP: 1 }, ...ground },
      abilities,
    },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
  })
}

describe('surface-aware unit settings', () => {
  it('keeps absent unit types available for priorities, sustain, and repair', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'BARONY_OF_LETNEV')
    setup.setCombatMode('GROUND')
    setup.setSurfaceUnitCount('attacker', P1, 'INFANTRY', 2)
    setup.setAbilityParam('attacker', 'DUNLAIN_REAPER', { uses: 1 })
    setup.setAbilityParam('attacker', 'DURANIUM_ARMOR', { isEnabled: true })
    for (const [ability, param] of [
      ['UNIT_PRIORITY', 'groundUnitPriority'],
      ['SUSTAIN_DAMAGE', 'groundPriority'],
      ['DURANIUM_ARMOR', 'groundRepairPriority'],
    ]) {
      expect(options(setup, ability, param).map(item => item.value)).toContain(
        target('MECH', P1),
      )
      expect(keys(setup, ability, param)).toContain(target('MECH', P1))
    }
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 2 },
        abilities: structuredClone(setup.abilities.attacker),
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    t.advanceRound(0)
    expect(t.attacker.units.MECH![0].isDamaged).not.toBe(true)
    expect(t.abilityLog('DURANIUM_ARMOR')).not.toHaveLength(0)
  })

  it('offers future system targets on legal surfaces while respecting explicit availability filters', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'LAST_BASTION')
    setup.addPlanet()
    const items = options(setup, 'DAME_BRIAR', 'spaceUnitType').map(
      item => item.value,
    )
    expect(items).toEqual(
      expect.arrayContaining([
        target('DREADNOUGHT', SPACE),
        target('INFANTRY', SPACE),
        target('INFANTRY', P1),
        target('INFANTRY', P2),
        target('PDS', P2),
      ]),
    )
    expect(items).not.toContain(target('DREADNOUGHT', P2))
    expect(options(setup, 'PRE_GALVANIZED', 'galvanizedUnits')).toEqual([])
  })

  it('retains preferences when starting units are removed', () => {
    const setup = new CombatSetup('FULL')
    setup.setSurfaceUnitCount('attacker', SPACE, 'DREADNOUGHT', 1)
    setup.setAbilityParam('attacker', 'SUSTAIN_DAMAGE', {
      spacePriority: [[target('DREADNOUGHT', SPACE), false]],
    })
    setup.setSurfaceUnitCount('attacker', SPACE, 'DREADNOUGHT', 0)
    const priority = setup.abilities.attacker.SUSTAIN_DAMAGE.spacePriority as [
      UnitLocator,
      boolean,
    ][]
    expect(new Map(priority).get(target('DREADNOUGHT', SPACE))).toBe(false)
    expect(
      options(setup, 'DURANIUM_ARMOR', 'spaceRepairPriority').map(
        item => item.value,
      ),
    ).toContain(target('DREADNOUGHT', SPACE))
  })

  it('offers every eligible type and extends Alastor ground forces to each surface', () => {
    const setup = setupWithAlastor()
    const items = options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')
    expect(items.map(item => item.value)).toEqual(
      expect.arrayContaining([
        target('FLAGSHIP', SPACE),
        target('INFANTRY', SPACE),
        target('INFANTRY', P1),
        target('INFANTRY', P2),
        target('MECH', P1),
        target('MECH', P2),
      ]),
    )
    expect(items.map(item => item.value)).not.toContain(target('PDS', P2))
    expect(items).toHaveLength(SHIPS.length + 6)
    expect(items.map(item => item.value)).toContain(
      target('DREADNOUGHT', SPACE),
    )
    expect(items.map(item => item.value)).toContain(target('MECH', SPACE))
    expect(keys(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')).toEqual(
      items.map(item => item.value),
    )
    setup.setAbilityParam('attacker', 'THE_ALASTOR', { isEnabled: false })
    expect(
      options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority').map(
        item => item.value,
      ),
    ).toEqual(expect.arrayContaining(SHIPS.map(type => target(type, SPACE))))
    expect(options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')).toHaveLength(
      SHIPS.length,
    )
  })

  it('keeps space-only category additions on the space surface', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NAAZ_ROKHA_ALLIANCE')
    setup.setSurfaceUnitCount('attacker', SPACE, 'CRUISER', 1)
    setup.setSurfaceUnitCount('attacker', SPACE, 'MECH', 1)
    setup.setSurfaceUnitCount('attacker', P1, 'MECH', 1)
    const items = options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')
    expect(items.map(item => item.value)).toContain(target('MECH', SPACE))
    expect(items.map(item => item.value)).not.toContain(target('MECH', P1))
  })

  it('qualifies only duplicate labels and groups independent controls in surface order', () => {
    const setup = setupWithAlastor()
    const items = options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')
    expect(labelUnitOptions(items).map(item => item.label)).toEqual(
      expect.arrayContaining([
        'Flagship',
        'Infantry (Space)',
        'Infantry (Planet 1)',
        'Infantry (Planet 2)',
      ]),
    )
    const groups = groupUnitOptions(
      options(setup, 'PRE_GALVANIZED', 'galvanizedUnits'),
    )
    expect(groups.map(group => group.label)).toEqual([
      'Space',
      'Planet 1',
      'Planet 2',
    ])
    expect(groups[2].items.map(item => item.label)).toContain('PDS')
  })

  it('applies independent Galvanized counts and caps to each surface', () => {
    const setup = setupWithAlastor()
    setup.setSurfaceUnitCount('attacker', P2, 'INFANTRY', 3)
    setup.setAbilityParam('attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [
        [target('INFANTRY', P1), 9],
        [target('INFANTRY', P2), 1],
      ],
    })
    const counts = new Map(
      setup.abilities.attacker.PRE_GALVANIZED.galvanizedUnits as [
        UnitLocator,
        number,
      ][],
    )
    expect(counts.get(target('INFANTRY', P1))).toBe(2)
    expect(counts.get(target('INFANTRY', P2))).toBe(1)
    expect(counts.get(target('INFANTRY', SPACE))).toBe(0)
    const maxima = new Map(
      options(setup, 'PRE_GALVANIZED', 'galvanizedUnits').map(item => [
        item.value,
        item.max,
      ]),
    )
    expect(maxima.get(target('INFANTRY', P1))).toBe(2)
    expect(maxima.get(target('INFANTRY', P2))).toBe(3)
    const t = alastorCombat({
      PRE_GALVANIZED: { galvanizedUnits: [[target('INFANTRY', P2), 1]] },
    })
    expect(
      [...getSurfaceUnitIds(t.state.attacker, P1)].map(
        id => t.state.attacker.unitType[id],
      ),
    ).toEqual(['INFANTRY'])
    expect(
      [...getSurfaceUnitIds(t.state.attacker, P2)].map(
        id => t.state.attacker.unitType[id],
      ),
    ).toEqual(['INFANTRY:Galvanized'])
  })

  it('limits declared subtypes and inherited checkbox values to their own surface', () => {
    const setup = setupWithAlastor()
    setup.setAbilityParam('attacker', 'SUSTAIN_DAMAGE', {
      spacePriority: [
        [target('MECH', P1), false],
        [target('MECH', P2), true],
      ],
    })
    setup.setAbilityParam('attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [[target('MECH', P1), 1]],
    })
    const items = options(setup, 'SUSTAIN_DAMAGE', 'spacePriority')
    expect(items.map(item => item.value)).toContain(
      target('MECH:Galvanized', P1),
    )
    expect(items.map(item => item.value)).not.toContain(
      target('MECH:Galvanized', P2),
    )
    const enabled = new Map(
      setup.abilities.attacker.SUSTAIN_DAMAGE.spacePriority as [
        UnitLocator,
        boolean,
      ][],
    )
    expect(enabled.get(target('MECH:Galvanized', P1))).toBe(false)
    expect(enabled.get(target('MECH', P2))).toBe(true)
  })

  it.each([
    [P1, P2],
    [P2, P1],
  ])(
    'assigns the first hit to the selected infantry on %s',
    (first, second) => {
      const t = alastorCombat({
        UNIT_PRIORITY: {
          spaceUnitPriority: [
            [target('INFANTRY', first)],
            [target('INFANTRY', second)],
            [target('FLAGSHIP', SPACE)],
          ],
        },
        SUSTAIN_DAMAGE: false,
      })
      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ attacker: 1 })
      expect(getSurfaceUnitIds(t.state.attacker, first)).toHaveLength(0)
      expect(getSurfaceUnitIds(t.state.attacker, second)).toHaveLength(1)
    },
  )

  it('uses surface matching for custom hits and sustain eligibility', () => {
    const t = alastorCombat({})
    t.advanceToTiming('START_OF_COMBAT_ROUND', 0, 'SPACE_COMBAT')
    const side = t.state.attacker
    CombatSideState.addCustomHits(side, 1, 'TEST', [target('INFANTRY', P2)])
    const first = getSurfaceUnitIds(side, P1)[0] as UnitId
    const second = getSurfaceUnitIds(side, P2)[0] as UnitId
    expect(CombatSideState.canAssignHitToUnit(side, first)).toBe(false)
    expect(CombatSideState.canAssignHitToUnit(side, second)).toBe(true)
    const casualties = CombatSideState.assignHits(side, true)
    expect(Object.values(casualties).flat()).toEqual([second])
  })

  it.each([
    [P1, P2],
    [P2, P1],
  ])('Duranium repairs the preferred damaged mech on %s', (first, second) => {
    const t = alastorCombat(
      {
        PRE_DAMAGED: {
          damagedUnits: [
            [target('MECH', P1), 1],
            [target('MECH', P2), 1],
          ],
        },
        DURANIUM_ARMOR: {
          isEnabled: true,
          spaceRepairPriority: [
            [target('MECH', first)],
            [target('MECH', second)],
          ],
        },
      },
      { [P1]: { MECH: 1 }, [P2]: { MECH: 1 } },
    )
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound(0)
    expect(
      t.state.attacker.unitState[getSurfaceUnitIds(t.state.attacker, first)[0]]
        ?.isDamaged,
    ).not.toBe(true)
    expect(
      t.state.attacker.unitState[getSurfaceUnitIds(t.state.attacker, second)[0]]
        ?.isDamaged,
    ).toBe(true)
  })

  it('Duranium skips a preferred mech that sustained this round', () => {
    const t = alastorCombat(
      {
        PRE_DAMAGED: { damagedUnits: [[target('MECH', P1), 1]] },
        SUSTAIN_DAMAGE: { spacePriority: [[target('MECH', P2), true]] },
        DURANIUM_ARMOR: {
          isEnabled: true,
          spaceRepairPriority: [[target('MECH', P2)], [target('MECH', P1)]],
        },
      },
      { [P1]: { MECH: 1 }, [P2]: { MECH: 1 } },
    )
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })
    expect(
      t.state.attacker.unitState[getSurfaceUnitIds(t.state.attacker, P1)[0]]
        ?.isDamaged,
    ).not.toBe(true)
    expect(
      t.state.attacker.unitState[getSurfaceUnitIds(t.state.attacker, P2)[0]]
        ?.isDamaged,
    ).toBe(true)
  })

  it('uses the opponent placements for opponent-target controls', () => {
    const setup = setupWithAlastor()
    const items = options(
      setup,
      'SPACE_CANNON_OFFENSE',
      'unitPriority',
      'defender',
    )
    expect(items.map(item => item.value)).toContain(target('INFANTRY', P2))
    const ability = setup
      .getAvailableAbilities('defender')
      .find(item => item.key === 'SPACE_CANNON_OFFENSE')!
    const ctx = setup.getReadContext('defender')
    const uiConfig = ability.uiConfig
    if (typeof uiConfig !== 'function') throw new Error('Expected UI factory')
    const controls = withRunningAbility(ctx, ability, () =>
      uiConfig(ctx, setup.abilities.defender.SPACE_CANNON_OFFENSE),
    )
    const priorityControl = controls.find(
      control => control.key === 'unitPriority',
    )
    if (priorityControl?.type !== 'unit-list')
      throw new Error('Expected unit list')
    expect(priorityControl.items).toEqual(items)
    expect(
      options(setup, 'SPACE_CANNON_OFFENSE', 'unitPriority', 'attacker'),
    ).toHaveLength(SHIPS.length)
    expect(
      options(setup, 'SPACE_CANNON_OFFENSE', 'unitPriority', 'attacker').every(
        item => item.surfaceId === SPACE,
      ),
    ).toBe(true)
  })

  it('projects committed ground forces and fighters onto the selected planet', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NAALU_COLLECTIVE')
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', SPACE, 'FLAGSHIP', 1)
    setup.setSurfaceUnitCount('attacker', SPACE, 'FIGHTER', 2)
    setup.setSurfaceUnitCount('attacker', SPACE, 'INFANTRY', 1)
    setup.setSurfaceUnitCount('attacker', P1, 'INFANTRY', 1)
    setup.setCombatMode('GROUND')
    expect(
      options(setup, 'UNIT_PRIORITY', 'groundUnitPriority').map(
        item => item.value,
      ),
    ).toEqual(
      expect.arrayContaining([target('FIGHTER', P2), target('INFANTRY', P2)]),
    )
    expect(
      options(setup, 'UNIT_PRIORITY', 'groundUnitPriority').map(
        item => item.value,
      ),
    ).not.toContain(target('INFANTRY', P1))
    setup.selectPlanet(P1)
    expect(
      options(setup, 'UNIT_PRIORITY', 'groundUnitPriority').map(
        item => item.value,
      ),
    ).toContain(target('FIGHTER', P1))
  })

  it('expands legacy counts once and preserves custom qualified choices through URL loading', () => {
    const setup = setupWithAlastor()
    setup.setAbilityParam('attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [['INFANTRY', 3]],
    })
    const counts = setup.abilities.attacker.PRE_GALVANIZED.galvanizedUnits as [
      UnitLocator,
      number,
    ][]
    expect(counts.reduce((sum, [, count]) => sum + count, 0)).toBe(3)
    expect(new Map(counts).get(target('INFANTRY', SPACE))).toBe(2)
    expect(new Map(counts).get(target('INFANTRY', P1))).toBe(1)
    setup.setAbilityParam('attacker', 'UNIT_PRIORITY', {
      spaceUnitPriority: [
        [target('INFANTRY', P2)],
        [target('INFANTRY', P1)],
        [target('INFANTRY', SPACE)],
      ],
    })
    const before = keys(setup, 'UNIT_PRIORITY', 'spaceUnitPriority')
    const raw = searchParamsToConfig(
      `?${configToSearchString(setup.toSerializedConfig())}`,
    )
    const validated = validateSerializedConfig(raw)
    expect(validated.warnings).toEqual([])
    const restored = new CombatSetup()
    restored.loadConfig(validated.config)
    expect(keys(restored, 'UNIT_PRIORITY', 'spaceUnitPriority')).toEqual(before)
    expect(restored.abilities.attacker.PRE_GALVANIZED.galvanizedUnits).toEqual(
      counts,
    )
  })

  it('round-trips compound variants without URL list delimiter collisions', () => {
    const setup = setupWithAlastor()
    const key = target('MECH:Cavalry,Galvanized', P2)
    const serialized = setup.toSerializedConfig()
    serialized.aa.UNIT_PRIORITY = { spaceUnitPriority: [[key]] }
    const raw = searchParamsToConfig(`?${configToSearchString(serialized)}`)
    expect(
      (raw.aa as typeof serialized.aa).UNIT_PRIORITY.spaceUnitPriority,
    ).toEqual([key])
    expect(parseUnitLocator(key)).toEqual({
      unitType: 'MECH:Cavalry,Galvanized',
      baseType: 'MECH',
      subtypes: ['Cavalry', 'Galvanized'],
      surfaceId: P2,
    })
    expect(UnitListSchema.safeParse([['@broken']]).success).toBe(false)
  })

  it('uses declarations to expose remote choices even before units are placed', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NEKRO_VIRUS')
    setup.addPlanet()
    for (const surface of [SPACE, P1, P2]) {
      const items = options(setup, 'DURANIUM_ARMOR', 'spaceRepairPriority')
      expect(items.map(item => item.value)).toContain(target('MECH', surface))
    }
    expect(
      options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority').map(
        item => item.value,
      ),
    ).not.toContain(target('PDS', P2))
    setup.setAbilityParam('attacker', 'THE_ALASTOR', { isEnabled: false })
    expect(
      options(setup, 'DURANIUM_ARMOR', 'spaceRepairPriority').every(
        item => item.surfaceId === SPACE,
      ),
    ).toBe(true)
  })

  it('keeps a dropdown target and its subtype on the chosen planet', () => {
    const setup = setupWithAlastor()
    setup.setAbilityParam('attacker', 'CAVALRY', {
      isEnabled: true,
      unitType: target('INFANTRY', P2),
    })
    expect(
      options(setup, 'CAVALRY', 'unitType').map(item => item.value),
    ).toContain(target('INFANTRY', P1))
    expect(
      options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority').map(
        item => item.value,
      ),
    ).toContain(target('INFANTRY:Cavalry', P2))
    expect(
      options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority').map(
        item => item.value,
      ),
    ).not.toContain(target('INFANTRY:Cavalry', P1))
    const t = alastorCombat({
      CAVALRY: { isEnabled: true, unitType: target('INFANTRY', P2) },
    })
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound(0)
    expect(
      t.state.attacker.unitType[getSurfaceUnitIds(t.state.attacker, P1)[0]],
    ).toBe('INFANTRY')
    expect(
      t.state.attacker.unitType[getSurfaceUnitIds(t.state.attacker, P2)[0]],
    ).toBe('INFANTRY:Cavalry')
  })

  it('previews a galvanized unit at its commitment destination', () => {
    const setup = new CombatSetup('FULL')
    setup.setSurfaceUnitCount('attacker', SPACE, 'MECH', 1)
    setup.setAbilityParam('attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [[target('MECH', SPACE), 1]],
    })
    setup.setCombatMode('GROUND')
    expect(
      options(setup, 'UNIT_PRIORITY', 'groundUnitPriority').map(
        item => item.value,
      ),
    ).toContain(target('MECH:Galvanized', P1))
    expect(
      options(setup, 'SUSTAIN_DAMAGE', 'groundPriority').map(
        item => item.value,
      ),
    ).toContain(target('MECH:Galvanized', P1))
  })

  it('preserves qualified selections through the simulation worker boundary', async () => {
    const setup = setupWithAlastor()
    setup.setAbilityParam('attacker', 'PRE_GALVANIZED', {
      galvanizedUnits: [[target('INFANTRY', P2), 1]],
    })
    setup.setAbilityParam('attacker', 'UNIT_PRIORITY', {
      spaceUnitPriority: [
        [target('INFANTRY:Galvanized', P2)],
        [target('INFANTRY', P1)],
      ],
    })
    const input = structuredClone(setup.toSimulationInput()!)
    const priority = input.abilities.attacker.UNIT_PRIORITY.spaceUnitPriority
    const worker = {
      onmessage: undefined as
        | ((event: MessageEvent<SimulationInput>) => void)
        | undefined,
      postMessage: vi.fn(),
    }
    vi.stubGlobal('self', worker)
    const simulate = vi
      .spyOn(CombatEngine.prototype, 'simulate')
      .mockImplementation(state => {
        const side = state.data.attacker
        expect(side.abilities.UNIT_PRIORITY.spaceUnitPriority).toEqual(priority)
        expect(
          CombatSideState.getUnits(side, target('INFANTRY:Galvanized', P2)),
        ).toHaveLength(1)
        expect(
          CombatSideState.getUnits(side, target('INFANTRY:Galvanized', P1)),
        ).toHaveLength(0)
        return []
      })
    try {
      await import('@/combat/combat.worker')
      worker.onmessage!({ data: input } as MessageEvent<SimulationInput>)
      expect(simulate).toHaveBeenCalledOnce()
      expect(worker.postMessage).toHaveBeenCalledWith([])
    } finally {
      simulate.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('keeps choices for an unselected planet through planet and mode switches', () => {
    const setup = new CombatSetup('FULL')
    setup.addPlanet()
    setup.setCombatMode('GROUND')
    for (const surface of [P1, P2])
      setup.setSurfaceUnitCount('attacker', surface, 'MECH', 1)
    setup.setAbilityParam('attacker', 'SUSTAIN_DAMAGE', {
      groundPriority: [[target('MECH', P2), false]],
    })
    setup.selectPlanet(P1)
    setup.setCombatMode('SPACE')
    setup.setCombatMode('GROUND')
    setup.selectPlanet(P2)
    const enabled = new Map(
      setup.abilities.attacker.SUSTAIN_DAMAGE.groundPriority as [
        UnitLocator,
        boolean,
      ][],
    )
    expect(enabled.get(target('MECH', P2))).toBe(false)
    expect(
      options(setup, 'SUSTAIN_DAMAGE', 'groundPriority').map(
        item => item.value,
      ),
    ).not.toContain(target('MECH', P1))
  })

  it('keeps a space cannon priority through a ground combat', () => {
    const setup = new CombatSetup('FULL')
    for (const type of ['CRUISER', 'DREADNOUGHT'] as const)
      setup.setSurfaceUnitCount('defender', SPACE, type, 1)
    const custom = keys(
      setup,
      'SPACE_CANNON_OFFENSE',
      'unitPriority',
    ).toReversed()
    setup.setAbilityParam('attacker', 'SPACE_CANNON_OFFENSE', {
      unitPriority: custom.map(key => [key]),
    })
    setup.setCombatMode('GROUND')
    setup.setCombatMode('SPACE')
    expect(keys(setup, 'SPACE_CANNON_OFFENSE', 'unitPriority')).toEqual(custom)
  })

  it('moves a single ground choice to the selected planet by unit type', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'FEDERATION_OF_SOL')
    setup.addPlanet()
    setup.setCombatMode('GROUND')
    setup.setAbilityParam('attacker', 'EVELYN_DELOUIS', {
      unitType: target('MECH', P2),
    })
    setup.setCombatMode('SPACE')
    expect(setup.abilities.attacker.EVELYN_DELOUIS.unitType).toBe(
      target('MECH', P2),
    )
    setup.setCombatMode('GROUND')
    setup.selectPlanet(P1)
    expect(setup.abilities.attacker.EVELYN_DELOUIS.unitType).toBe(
      target('MECH', P1),
    )
  })

  it('follows the listed planet when fighter-last custom hits span surfaces', () => {
    const t = alastorCombat({})
    t.advanceToTiming('START_OF_COMBAT_ROUND', 0, 'SPACE_COMBAT')
    const side = t.state.attacker
    // Prefer the infantry nearer the head, so a tail-first walk would miss.
    const [preferred] = [P1, P2]
      .map(surface => getSurfaceUnitIds(side, surface)[0] as UnitId)
      .sort(
        (a, b) =>
          side.participatingUnits.indexOf(a) -
          side.participatingUnits.indexOf(b),
      )
    CombatSideState.addCustomHits(side, 1, 'TEST', [
      target('INFANTRY', side.unitSurface[preferred]),
      'FLAGSHIP',
      'FIGHTER',
    ])
    const casualties = CombatSideState.assignHits(side, true)
    expect(Object.values(casualties).flat()).toEqual([preferred])
  })

  it('skips fighter-last tiers for another surface when every target is in space', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1, DESTROYER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })
    t.advanceToTiming('START_OF_COMBAT_ROUND', 0, 'SPACE_COMBAT')
    const side = t.state.attacker
    const tail = side.unitType[side.participatingUnits.at(-1)!]
    const head = side.unitType[side.participatingUnits[0]]
    CombatSideState.addCustomHits(side, 1, 'TEST', [
      target(tail, P1),
      target(head, SPACE),
      target(tail, SPACE),
      target('FIGHTER', SPACE),
    ])
    const casualties = CombatSideState.assignHits(side, true)
    expect(
      Object.values(casualties)
        .flat()
        .map(id => side.unitType[id]),
    ).toEqual([head])
  })

  it('drops removed surfaces and keeps reinforcement choices type-only', () => {
    const setup = setupWithAlastor()
    for (const type of ['INFANTRY', 'MECH', 'PDS'] as const)
      setup.setSurfaceUnitCount('attacker', P2, type, 0)
    setup.removePlanet(P2)
    expect(
      options(setup, 'UNIT_PRIORITY', 'spaceUnitPriority').some(
        item => item.surfaceId === P2,
      ),
    ).toBe(false)
    setup.setFaction('attacker', 'COUNCIL_KELERES')
    expect(
      options(setup, 'OVERWING_ZETA', 'ships').every(
        item => item.surfaceId === undefined,
      ),
    ).toBe(true)
  })
})
