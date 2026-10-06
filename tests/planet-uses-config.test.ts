import { describe, expect, it } from 'vitest'

import { CombatState } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { prepareSimulation } from '@/hooks/combat-setup/prepare-simulation'
import { validateSerializedConfig } from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'

import { setAbility } from './utils/setup-options'
import { PLANET_1, PLANET_2 } from './utils/surface-units'

function twoPlanetSetup(): CombatSetup {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.addPlanet()
  for (const planet of [PLANET_1, PLANET_2]) {
    setup.setSurfaceUnitCount('attacker', planet, 'INFANTRY', 1)
    setup.setSurfaceUnitCount('defender', planet, 'INFANTRY', 1)
  }
  return setup
}

describe('planet uses config', () => {
  it('keeps caps within the uses', () => {
    const setup = twoPlanetSetup()
    setAbility(setup, 'attacker', 'MORALE_BOOST', {
      uses: 2,
      planetUses: [
        [PLANET_1, 2],
        [PLANET_2, 1],
      ],
    })

    expect(setup.abilities.attacker.MORALE_BOOST.planetUses).toEqual([
      [PLANET_1, 2],
      [PLANET_2, 1],
    ])

    setAbility(setup, 'attacker', 'MORALE_BOOST', { uses: 1 })
    expect(setup.abilities.attacker.MORALE_BOOST.planetUses).toEqual([
      [PLANET_1, 1],
      [PLANET_2, 1],
    ])

    setAbility(setup, 'attacker', 'MORALE_BOOST', { uses: Infinity })
    expect(setup.abilities.attacker.MORALE_BOOST).not.toHaveProperty(
      'planetUses',
    )
  })

  it('drops caps of an ability used once for the system', () => {
    const setup = twoPlanetSetup()
    setAbility(setup, 'attacker', 'BLITZ', {
      isEnabled: true,
      planetUses: [[PLANET_1, 0]],
    })

    expect(setup.abilities.attacker.BLITZ).not.toHaveProperty('planetUses')
  })

  it('drops caps of a removed planet', () => {
    const setup = twoPlanetSetup()
    setAbility(setup, 'attacker', 'MORALE_BOOST', {
      uses: 2,
      planetUses: [[PLANET_2, 0]],
    })

    setup.setEditorMode('SIMPLIFIED')

    expect(setup.abilities.attacker.MORALE_BOOST).not.toHaveProperty(
      'planetUses',
    )
  })

  it('reaches the simulation', () => {
    const setup = twoPlanetSetup()
    setAbility(setup, 'attacker', 'MORALE_BOOST', {
      uses: 2,
      planetUses: [[PLANET_1, 0]],
    })

    const state = CombatState.forSimulation(
      prepareSimulation(setup.toSimulationInput()!),
    )

    expect(state.data.planetUses).toEqual([
      expect.objectContaining({
        side: 'attacker',
        key: 'MORALE_BOOST',
        reserved: 2,
        entered: 0,
      }),
    ])
  })

  it('round-trips through the URL', () => {
    const setup = twoPlanetSetup()
    setAbility(setup, 'attacker', 'MORALE_BOOST', {
      uses: 2,
      planetUses: [[PLANET_2, 1]],
    })

    const raw = searchParamsToConfig(
      configToSearchString(setup.toSerializedConfig()),
    )
    const { config, warnings } = validateSerializedConfig(raw)

    expect(warnings).toEqual([])
    expect(config.aa.MORALE_BOOST.planetUses).toEqual([[PLANET_2, 1]])
  })
})
