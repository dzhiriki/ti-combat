import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import { buildAbilityLookup } from '@/hooks/combat-setup/validation'

import { configToSearchString, searchParamsToConfig } from './use-url-sync'

const abilityLookup = buildAbilityLookup(getAllAbilities())

describe('unit-list params through the URL', () => {
  it('round-trips damaged unit counts', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'SARDAKK_NORR')
    setup.setUnitCount('attacker', 'DREADNOUGHT', 2)
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setAbilityParam('attacker', 'PRE_DAMAGED', {
      ...setup.abilities.attacker['PRE_DAMAGED'],
      damagedUnits: [['DREADNOUGHT', 1]],
    })

    const search = configToSearchString(setup.toSerializedConfig())
    // Every entry has to carry its count, or the codec reads the list back as
    // a flat array of unit names and the damage is lost.
    expect(search).toContain(
      'aa.PRE_DAMAGED.damagedUnits=CRUISER~0,DREADNOUGHT~1',
    )

    const decoded = searchParamsToConfig(search, abilityLookup)
    const restored = new CombatSetup()
    restored.loadConfig(decoded as never)
    expect(restored.abilities.attacker['PRE_DAMAGED'].damagedUnits).toEqual([
      ['CRUISER', 0],
      ['DREADNOUGHT', 1],
    ])
  })
})
