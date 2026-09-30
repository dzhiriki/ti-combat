import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EIDOLON + RAID_FORMATION', () => {
  it('does not damage Eidolon mechs that lost sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: {
          RAID_FORMATION: {
            targetPriority: [['MECH'], ['FLAGSHIP']],
          },
        },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 2 },
      },
    })

    // The cruiser admits the defender to combat, then Eidolon transforms.
    // 3 destroyers AFB 9x2 = 6 dice, 0 fighters = all hits excess.
    // Eidolon mechs are ships but have lost sustain — not valid targets.
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 2, 'AFB')

    expect(t.abilityLog('RAID_FORMATION')).not.toHaveLength(0)
    expect(t.defender.units.MECH![0].isDamaged).toBeFalsy()
    expect(t.defender.units.MECH![1].isDamaged).toBeFalsy()
  })
})
