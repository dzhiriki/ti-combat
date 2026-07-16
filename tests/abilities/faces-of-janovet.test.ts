import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// El Nen Janovet flagship: gains the unit abilities and text abilities of the
// side's destroyer, cruiser, and dreadnought unit-upgrade cards.
describe('TF_FACES_OF_JANOVET', () => {
  it('gains AFB from an enabled destroyer upgrade (Exile)', () => {
    // Flagship inherits AFB [6,3] → 3 dice at 6+ against 2 fighters.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: { TF_UPGRADE_EXILE: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1, FIGHTER: 2 },
      },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP')

    // AFB hits landed on fighters — with no AFB there would be exactly 2.
    expect(t.dicePool().attacker).toContainDice('FLAGSHIP', [6, 3])
  })

  it('gains Bombardment and Spark immunity from a dreadnought upgrade', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
        abilities: { TF_UPGRADE_SUPER_DREADNOUGHT: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.dicePool().attacker).toContainDice('FLAGSHIP', [4, 1])
  })

  it('inherits nothing from war sun upgrades or with no cards enabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
        abilities: { TF_UPGRADE_PROTOTYPE_WAR_SUN: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    // War sun cards are not part of the inheritance — no bombardment dice.
    expect(t.dicePool().attacker).not.toContainDice('FLAGSHIP', [3, 3])
  })

  it("inherits Strike Wing Alpha's AFB text: naturals 9/10 destroy infantry", () => {
    // Flagship AFB [6,3] via SWA → same distribution as the destroyer test.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: { TF_UPGRADE_STRIKE_WING_ALPHA: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 3 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.512 },
      { value: 2, probability: 0.384 },
      { value: 1, probability: 0.096 },
      { value: 0, probability: 0.008 },
    ])
  })
})
