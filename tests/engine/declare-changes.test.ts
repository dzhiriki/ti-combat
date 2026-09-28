import { describe, expect, it, vi } from 'vitest'

import { type Ability, CombatSideState, makeUnitLocator } from '@/combat'
import { resolveUnitOptions } from '@/combat/abilities-engine/unit-options'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { isUnitCategory } from '@/combat/utils/unit-combat-properties'
import { CombatSetup } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import {
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
  type SurfaceId,
  type UnitType,
} from '@/types'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

/** Grants SHIPS to the side's units of `unitType`, mechs by default. */
function shipGrant(invoked: boolean): Ability {
  return {
    key: 'TEST_SHIP_GRANT',
    name: 'Ship grant',
    params: { isEnabled: true, uses: Infinity, unitType: 'MECH' },
    headerUI: 'isEnabled',
    declareChanges: (ctx, params) => {
      const units = ctx.api.own.system.getUnits(params.unitType as UnitType, {
        includeVariants: true,
      })
      ctx.api.own.grantCategory(units, 'SHIPS')
    },
    invoke: invoked
      ? [
          {
            timing: 'START_OF_COMBAT',
            isCallable: (_params, ctx) => ctx.side === 'attacker',
            call: ctx => {
              ctx.invokeChanges()
            },
          },
        ]
      : [],
  }
}

/** Places `count` of `unitType` in the space area, from `timing` on. */
function placer(
  unitType: UnitType,
  count: number,
  timing?: 'START_OF_COMBAT',
): Ability {
  return {
    key: `TEST_PLACE_${unitType}`,
    name: 'Placer',
    params: { isEnabled: true, uses: Infinity },
    headerUI: 'isEnabled',
    declareChanges: ctx => {
      ctx.api.own.placeUnits({ [unitType]: count }, SPACE_SURFACE_ID)
    },
    invoke: timing
      ? [
          {
            timing,
            isCallable: (_params, ctx) => ctx.side === 'attacker',
            call: ctx => {
              ctx.invokeChanges()
            },
          },
        ]
      : [],
  }
}

function spacePriorityTypes(abilities: Record<string, unknown>): string[] {
  const sustain = abilities.SUSTAIN_DAMAGE as {
    spacePriority: [string, boolean][]
  }
  return sustain.spacePriority.map(
    ([unit]) => parseUnitLocator(unit as UnitType).unitType,
  )
}

describe('declareChanges', () => {
  it('shapes setup options while the engine leaves units alone', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1, MECH: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [shipGrant(false)],
    })
    expect(spacePriorityTypes(t.state.attacker.abilities)).toContain('MECH')

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const [mech] = unitsByBaseType(t.state.attacker).MECH!
    expect(isUnitCategory(t.state.attacker, mech, 'SHIPS')).toBe(false)
  })

  it('applies the change through invokeChanges with the configured params', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, MECH: 1, INFANTRY: 1 },
        abilities: {
          TEST_SHIP_GRANT: { isEnabled: true, unitType: 'INFANTRY' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [shipGrant(true)],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const units = unitsByBaseType(t.state.attacker)
    expect(isUnitCategory(t.state.attacker, units.INFANTRY![0], 'SHIPS')).toBe(
      true,
    )
    expect(isUnitCategory(t.state.attacker, units.MECH![0], 'SHIPS')).toBe(
      false,
    )
  })

  it('throws when an invoke runs changes its ability does not declare', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [
        {
          key: 'TEST_NO_CHANGES',
          name: 'No changes',
          params: { isEnabled: true, uses: Infinity },
          headerUI: 'isEnabled',
          invoke: [
            {
              timing: 'START_OF_COMBAT',
              call: ctx => {
                ctx.invokeChanges()
              },
            },
          ],
        },
      ],
    })

    t.advanceTo('SPACE_COMBAT')
    expect(() => t.advanceRound()).toThrow(
      'TEST_NO_CHANGES declares no changes',
    )
  })

  it('ignores the changes of a disabled ability', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { TEST_SHIP_GRANT: { isEnabled: false } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [shipGrant(false)],
    })

    expect(spacePriorityTypes(t.state.attacker.abilities)).not.toContain('MECH')
  })

  it('leaves the simulation state free of the setup model and its grants', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1, MECH: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [shipGrant(false)],
    })

    const attacker = state.data.attacker
    expect(CombatSideState.getCategoryOptionTypes(attacker, 'SHIPS')).toContain(
      'MECH',
    )
    expect(attacker.unitGrants).toBeUndefined()
    expect(Object.keys(attacker.unitType)).toHaveLength(2)
  })

  it('offers granted choices only where units stand, with caps from placed units', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NEKRO_VIRUS')
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', DEFAULT_PLANET_ID, 'INFANTRY', 2)

    const options = resolveUnitOptions(
      setup.stateData.attacker,
      {
        combatMode: 'SPACE',
        activeSurfaceId: SPACE_SURFACE_ID,
        surfaces: setup.surfaces,
        side: 'attacker',
        allSurfaces: true,
      },
      {
        source: 'GROUND_FORCES',
        scope: 'participating',
        limit: 'IN_COMBAT',
        filter: { combatMode: 'SPACE' },
      },
    )
    const caps = new Map(options.map(option => [option.value, option.max]))
    const infantry = (surface: SurfaceId) =>
      caps.get(makeUnitLocator('INFANTRY', surface))

    // The Alastor grants the infantry SHIPS; no infantry stands elsewhere.
    expect(infantry(DEFAULT_PLANET_ID)).toBe(2)
    expect(infantry('planet-2' as SurfaceId)).toBeUndefined()
    expect(infantry(SPACE_SURFACE_ID)).toBeUndefined()
  })

  it('lets a change see units that later abilities declare', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [shipGrant(false), placer('MECH', 1)],
    })

    // The grant runs first, yet a later pass grants the declared mech.
    expect(spacePriorityTypes(t.state.attacker.abilities)).toContain('MECH')
    expect(t.attacker.units.MECH).toBeUndefined()
  })

  it('declares one unit per variant and surface, within unit limits', () => {
    const warn = vi.spyOn(console, 'warn')
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { WAR_SUN: 2, CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [placer('FIGHTER', 5), placer('WAR_SUN', 1)],
    })

    const model = t.state.attacker.optionMetadata!.model
    const types = (model.participatingUnits + model.nonParticipatingUnits)
      .split('')
      .map(id => model.unitType[id as keyof typeof model.unitType])
    expect(types.filter(type => type === 'FIGHTER')).toHaveLength(1)
    // Both war suns are fielded, so none is declared.
    expect(types.filter(type => type === 'WAR_SUN')).toHaveLength(2)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('places for real when an invoke runs the changes', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      customAbilities: [placer('FIGHTER', 2, 'START_OF_COMBAT')],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })
})
