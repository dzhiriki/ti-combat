import { describe, expect, it } from 'vitest'

import type { SavedRetreatData } from '@/data/main'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('WATCHFUL_OJZ', () => {
  it('retreats up to 2 ships when retreat is announced', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { CRUISER: 3 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          WATCHFUL_OJZ: { isEnabled: true, shipConfig: [['CRUISER', 2]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    // All 3 cruisers saved in RETREAT config (2 by Ojz + 1 by RETREAT)
    const saved = (
      t.state.attacker.abilities.RETREAT as Record<string, unknown>
    )?._saved as SavedRetreatData
    expect(saved?.savedUnits.CRUISER).toHaveLength(3)
    expect(t.abilityLog('WATCHFUL_OJZ')).not.toHaveLength(0)
  })

  it('does not fire without retreat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { CRUISER: 3 },
        abilities: {
          WATCHFUL_OJZ: { isEnabled: true, shipConfig: [['CRUISER', 2]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('WATCHFUL_OJZ')).toHaveLength(0)
  })
})
