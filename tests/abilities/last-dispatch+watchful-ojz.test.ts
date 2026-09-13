import { describe, expect, it } from 'vitest'

import type { SavedRetreatData } from '@/data/main'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LAST_DISPATCH + WATCHFUL_OJZ', () => {
  it('fires when Watchful Ojz retreats the flagship early', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { FLAGSHIP: 1, CRUISER: 2 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          WATCHFUL_OJZ: {
            isEnabled: true,
            shipConfig: [
              ['FLAGSHIP', 1],
              ['CRUISER', 1],
            ],
          },
          LAST_DISPATCH: true,
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
    // Ojz retreats flagship at ANNOUNCE_RETREAT, triggering Last Dispatch
    expect(t.abilityLog('LAST_DISPATCH')).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)

    // Flagship should be in retreat saved data
    const saved = (
      t.state.attacker.abilities.RETREAT as Record<string, unknown>
    )?._saved as SavedRetreatData
    expect(saved?.savedUnits.FLAGSHIP).toHaveLength(1)
  })
})
