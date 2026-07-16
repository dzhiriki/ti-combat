import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// The default TF war sun (unlike TI4's) does NOT disable Planetary Shield —
// only the upgrade cards (Prototype War Sun / University War Sun) do.
describe('TF war sun vs Planetary Shield', () => {
  it('base war sun bombardment is blocked by Planetary Shield', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { WAR_SUN: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    // PDS Planetary Shield holds → no war sun bombardment dice
    expect(t.dicePool().attacker).not.toContainDice('WAR_SUN', [5, 3])
  })

  // The leak that broke this also broke every OTHER bombardier: the loose
  // DISABLE_PLANETARY_SHIELD config ability ran always-on for TF sides,
  // marking shields lost even with no war sun on the field.
  it('dreadnought bombardment is blocked by Planetary Shield', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.dicePool().attacker).not.toContainDice('DREADNOUGHT', [5, 1])
  })

  it('Prototype War Sun upgrade disables Planetary Shield', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { WAR_SUN: 1, INFANTRY: 1 },
        abilities: { TF_UPGRADE_PROTOTYPE_WAR_SUN: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    // Upgraded stats [3,3] and shield disabled → bombardment fires
    expect(t.dicePool().attacker).toContainDice('WAR_SUN', [3, 3])
  })
})
