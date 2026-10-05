import { describe, expect, it } from 'vitest'

import { type DicePool, makeUnitLocator, makeVariantId } from '@/combat'
import { GALVANIZED } from '@/data/main/abilities/general/pre-galvanized'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { setAbility, setupOptions } from '../utils/setup-options'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

const at = makeUnitLocator
const GALVANIZED_DREADNOUGHT = makeVariantId('DREADNOUGHT', [GALVANIZED])

function bombardmentPools(log: ReturnType<typeof combatTest>['log']) {
  return log
    .filter(entry => entry.path.at(-1) === 'DICE_POOL')
    .map(entry => entry.data?.[0] as { attacker: DicePool; hitSource: string })
    .filter(pool => pool.hitSource === 'BOMBARDMENT')
}

describe('BOMBARDMENT + PRE_GALVANIZED', () => {
  it('offers galvanized bombarding units apart from the normal ones', () => {
    const setup = new CombatSetup('FULL')
    setup.setCombatMode('GROUND')
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'DREADNOUGHT', 3)
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
    setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)
    setAbility(setup, 'attacker', 'PRE_GALVANIZED', {
      isEnabled: true,
      galvanizedUnits: [[at('DREADNOUGHT', SPACE_SURFACE_ID), 1]],
    })

    expect(
      setupOptions(setup, 'BOMBARDMENT', 'units').map(item => [
        item.value,
        item.max,
      ]),
    ).toEqual([
      [at('DREADNOUGHT', PLANET_1), 2],
      [at('DREADNOUGHT', PLANET_2), 2],
      [at(GALVANIZED_DREADNOUGHT, PLANET_1), 1],
      [at(GALVANIZED_DREADNOUGHT, PLANET_2), 1],
    ])
  })

  it('bombards with the galvanized unit where the split sends it', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'ARBOREC',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { DREADNOUGHT: 2, INFANTRY: 1 } },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [[at('DREADNOUGHT', SPACE_SURFACE_ID), 1]],
          },
          BOMBARDMENT: {
            units: [
              [at('DREADNOUGHT', PLANET_1), 1],
              [at(GALVANIZED_DREADNOUGHT, PLANET_2), 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('COMMIT_UNITS', { defender: 1 })

    const pools = bombardmentPools(t.log)
    expect(pools).toHaveLength(2)
    expect(pools[0].attacker).toContainDice('DREADNOUGHT', [5, 1])
    // Pools key by base type; the galvanized dreadnought rolls 2 dice.
    expect(pools[1].attacker).toContainDice('DREADNOUGHT', [5, 2])
  })
})
