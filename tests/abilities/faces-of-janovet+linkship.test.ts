import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// The Faces of Janovet copies the Linkship text onto the flagship, which then
// destroys a ship when it retreats itself.
describe('TF_FACES_OF_JANOVET + TF_UPGRADE_LINKSHIP', () => {
  it('the retreating flagship destroys an eligible ship without a destroyer', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: {
          TF_UPGRADE_LINKSHIP: true,
          RETREAT: { isEnabled: true, rounds: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('TF_UPGRADE_LINKSHIP')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('the flagship and a Linkship destroyer each destroy a ship', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1, DESTROYER: 1 },
        abilities: {
          TF_UPGRADE_LINKSHIP: true,
          RETREAT: { isEnabled: true, rounds: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('TF_UPGRADE_LINKSHIP')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('the flagship destroys nothing on retreat without the card', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: { RETREAT: { isEnabled: true, rounds: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('TF_UPGRADE_LINKSHIP')).toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })
})
