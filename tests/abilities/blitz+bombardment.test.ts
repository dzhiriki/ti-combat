import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { setAbility, setupOptions } from '../utils/setup-options'
import { PLANET_1 } from '../utils/surface-units'

const at = makeUnitLocator

function bombardingSetup() {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'DREADNOUGHT', 1)
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'CRUISER', 2)
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'FIGHTER', 1)
  setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
  return setup
}

const offered = (setup: CombatSetup) =>
  setupOptions(setup, 'BOMBARDMENT', 'units').map(item => [
    item.value,
    item.max,
  ])

describe('BLITZ + BOMBARDMENT', () => {
  it('offers the ships Blitz grants Bombardment to', () => {
    const setup = bombardingSetup()
    setAbility(setup, 'attacker', 'BLITZ', { isEnabled: true })

    expect(offered(setup)).toEqual([
      [at('DREADNOUGHT', PLANET_1), 1],
      [at('CRUISER', PLANET_1), 2],
    ])
  })

  it('offers only native bombarding units without Blitz', () => {
    expect(offered(bombardingSetup())).toEqual([
      [at('DREADNOUGHT', PLANET_1), 1],
    ])
  })
})
