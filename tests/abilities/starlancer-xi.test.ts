import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { isUnitCategory } from '@/combat/utils/unit-combat-properties'
import { CombatSetup } from '@/hooks/combat-setup'
import {
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
  type UnitId,
  type UnitLocator,
} from '@/types'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

// Starlancer XI is a ground force that is also a ship during space combat (a
// phase-scoped category). Ships fight from any surface, so unlike Z-Grav
// Eidolon its mechs on planets join too. Special combat-end rules are deferred.
const SURFACES = [SPACE_SURFACE_ID, DEFAULT_PLANET_ID]

describe('TF_STARLANCER_XI', () => {
  it('mechs roll in space combat alongside ships', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    expect(pool.attacker).toContainDice('MECH', [6, 1])
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies +1 per anomaly to the mech rolls only', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { TF_STARLANCER_XI: { isEnabled: true, anomalies: 2 } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Mech [6,1] with +2 → hits on 4; the cruiser is untouched.
    expect(pool.attacker).toContainDice('MECH', [4, 1])
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('mech sits in the assign-hits order at its worth slot by default', () => {
    // Sustain disabled so pure assignment order is observable: the fighter
    // (front of the worth-asc list) soaks before the mech.
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FIGHTER: 1, CRUISER: 1, MECH: 1 },
        abilities: { SUSTAIN_DAMAGE: { isEnabled: false } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('dragging MECH to the front sacrifices mechs in space first', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FIGHTER: 1, CRUISER: 1, MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: { isEnabled: false },
          // MECH is a normal reorderable entry — front takes hits first
          UNIT_PRIORITY: {
            spaceUnitPriority: [['MECH'], ['FIGHTER'], ['CRUISER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it.each(SURFACES)(
    'mechs participate without any other ships (%s)',
    surface => {
      const t = combatTest({
        system: 'TF',
        mode: 'SPACE',
        attacker: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
        defender: {
          faction: 'IL_NA_VIROSET',
          units: {},
          placements: { [surface]: { MECH: 2 } },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      t.advanceRound()

      expect(t.isFinished()).toBe(false)
      expect(t.dicePool().defender.MECH).toEqual([
        [6, 1],
        [6, 1],
      ])
      const side = t.state.defender
      for (const mech of unitsByBaseType(side).MECH!) {
        expect(isUnitCategory(side, mech, 'SHIPS', 'SPACE_COMBAT')).toBe(true)
        expect(
          isUnitCategory(side, mech, 'SHIPS', 'SPACE_CANNON_OFFENSE'),
        ).toBe(false)
        expect(isUnitCategory(side, mech, 'GROUND_FORCES')).toBe(true)
      }
    },
  )

  it('mechs on a planet fight in the space combat too', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { MECH: 1 },
          [DEFAULT_PLANET_ID]: { MECH: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.dicePool().attacker.MECH).toEqual([
      [6, 1],
      [6, 1],
    ])
    const mechs = unitsByBaseType(t.state.attacker).MECH!
    expect(mechs.map(id => t.state.attacker.unitSurface[id]).sort()).toEqual(
      [DEFAULT_PLANET_ID, SPACE_SURFACE_ID].sort(),
    )
    for (const id of mechs) {
      expect(t.state.attacker.participatingUnits).toContain(id)
    }
  })

  it('mechs on a planet sustain hits in the space combat', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [DEFAULT_PLANET_ID]: { MECH: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })

  it('offers mechs on a planet in the space combat priorities', () => {
    const setup = new CombatSetup('FULL')
    setup.setSystem('TF')
    setup.setFaction('attacker', 'IL_NA_VIROSET')
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'CRUISER', 1)
    setup.setSurfaceUnitCount('attacker', DEFAULT_PLANET_ID, 'MECH', 1)

    const keys = (ability: string, param: string) =>
      (setup.abilities.attacker[ability][param] as [UnitLocator][]).map(
        ([key]) => key,
      )
    for (const [ability, param] of [
      ['UNIT_PRIORITY', 'spaceUnitPriority'],
      ['SUSTAIN_DAMAGE', 'spacePriority'],
    ]) {
      expect(keys(ability, param)).toContain(
        makeUnitLocator('MECH', DEFAULT_PLANET_ID),
      )
      // No mech stands in the space area.
      expect(keys(ability, param)).not.toContain(
        makeUnitLocator('MECH', SPACE_SURFACE_ID),
      )
    }
  })

  it('space-area mechs keep the combat going after the last ship dies — and can win', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          // Deterministic: no sustain, the cruiser soaks the hit.
          SUSTAIN_DAMAGE: { isEnabled: false },
          UNIT_PRIORITY: { spaceUnitPriority: [['CRUISER'], ['MECH']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: the cruiser dies, but the mech is IN the space area — the
    // combat continues.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.isFinished()).toBe(false)
    expect(t.attacker.units.MECH).toHaveLength(1)

    // Round 2: the mech kills the defender's cruiser and wins.
    t.advanceRound({ attacker: 0, defender: 1 })
    expect(t.state.winnerSide).toBe('attacker')
  })

  it('retains native ground-force participation', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: { faction: 'IL_NA_VIROSET', units: { MECH: 1 } },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    expect(t.dicePool().attacker).toContainDice('MECH', [6, 1])
  })

  it.each(SURFACES)(
    'automatically joins the first mech placed during combat (%s)',
    surface => {
      let placed: UnitId
      const t = combatTest({
        system: 'TF',
        mode: 'SPACE',
        attacker: {
          faction: 'IL_NA_VIROSET',
          units: { CRUISER: 1 },
          abilities: { TF_STARLANCER_XI: { anomalies: 2 } },
        },
        defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
        customAbilities: [
          {
            key: 'TEST_REINFORCEMENTS',
            name: 'Reinforcements',
            params: { isEnabled: true, uses: 1 },
            invoke: [
              {
                timing: 'START_OF_COMBAT_ROUND',
                isCallable: (_params, ctx) => ctx.side === 'attacker',
                call: ctx => {
                  ;[placed] = ctx.api.own.placeUnits({ MECH: 1 }, surface).MECH
                },
              },
            ],
          },
        ],
      })
      t.advanceTo('SPACE_COMBAT')
      t.advanceRound()
      expect(t.state.attacker.unitSurface[placed!]).toBe(surface)
      expect(t.state.attacker.participatingUnits).toContain(placed!)
      expect(
        isUnitCategory(t.state.attacker, placed!, 'SHIPS', t.state.meta),
      ).toBe(true)
      expect(isUnitCategory(t.state.attacker, placed!, 'GROUND_FORCES')).toBe(
        true,
      )
      expect(t.state.attacker.unitGrants?.[placed!]).toBeUndefined()
      expect(t.dicePool().attacker).toContainDice('MECH', [4, 1])
    },
  )

  it.each([
    ['space', { [SPACE_SURFACE_ID]: { CRUISER: 1, MECH: 1 } }],
    [
      'planet',
      { [SPACE_SURFACE_ID]: { CRUISER: 1 }, [DEFAULT_PLANET_ID]: { MECH: 1 } },
    ],
  ])('is not a ship during space cannon offense (%s)', (_name, placements) => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'IL_NA_VIROSET', units: {}, placements },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })
    // The cruiser is the only ship to take the hit (a ship mech would sustain
    // it), yet the lone mech still starts the space combat.
    t.advanceTo('SPACE_COMBAT', { attacker: 1 })
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.MECH![0].isDamaged).not.toBe(true)
    t.advanceRound()
    expect(t.dicePool().attacker.MECH).toEqual([[6, 1]])
  })

  it('is not a ship without a space combat, so alone it does not win', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'IL_NA_VIROSET', units: { MECH: 2 } },
      defender: { faction: 'AVARICE_REX', units: {} },
    })

    t.advanceTo('COMPLETE')

    expect(t.state.winnerSide).toBe('draw')
    expect(t.attacker.units.MECH).toHaveLength(2)
  })

  it('uses the normal Sustain Priority control to withhold mech sustain', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: { spacePriority: [['MECH', false]] },
          // Mechs soak first so the hit would go to the mech either way.
          UNIT_PRIORITY: { spaceUnitPriority: [['MECH'], ['CRUISER']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // With sustain the mech would absorb the hit; disabling it in the
    // standard priority control makes the mech die outright.
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
