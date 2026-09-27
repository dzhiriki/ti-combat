import { describe, expect, it } from 'vitest'

import { extractDefaults, withRunningAbility } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { CombatSetup } from '@/hooks/combat-setup'
import type { UnitList } from '@/types'

import { combatTest } from '../utils/combat-test'

/** The attacker's Exotrireme card config. */
function cardParams(setup: CombatSetup) {
  return setup.abilities.attacker.TF_UPGRADE_EXOTRIREME as {
    sacrificePriority: UnitList<boolean>
  }
}

/** Update the card as the panel does: with its complete params. */
function setCardParams(setup: CombatSetup, params: Record<string, unknown>) {
  setup.setAbilityParam('attacker', 'TF_UPGRADE_EXOTRIREME', {
    ...cardParams(setup),
    ...params,
  })
}

/** Unit types of the side's reconciled Exotrireme sacrifice list. */
function sacrificeTypes(setup: CombatSetup): string[] {
  return cardParams(setup).sacrificePriority.map(
    ([key]) => parseUnitLocator(key).unitType,
  )
}

/** The Exotrireme card's controls on the attacker's panel, by param. */
function controls(setup: CombatSetup) {
  const card = setup
    .getAvailableAbilities('attacker')
    .find(ability => ability.key === 'TF_UPGRADE_EXOTRIREME')!
  const { uiConfig } = card
  if (typeof uiConfig !== 'function') throw new Error('uiConfig not a factory')
  const ctx = setup.getReadContext('attacker')
  const params = {
    ...extractDefaults(card),
    ...setup.abilities.attacker[card.key],
  }
  const items = withRunningAbility(ctx, card, () => uiConfig(ctx, params))
  return Object.fromEntries(items.map(item => [item.key, item]))
}

// The Faces of Janovet copies the Exotrireme text onto the flagship, which
// then joins the sacrifice list and may destroy itself.
describe('TF_UPGRADE_EXOTRIREME + TF_FACES_OF_JANOVET', () => {
  it.forEachSide('the flagship sacrifices itself to destroy 2 ships', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: { TF_UPGRADE_EXOTRIREME: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it.forEachSide(
    'sacrifices a dreadnought before the flagship by default',
    () => {
      const t = combatTest({
        system: 'TF',
        mode: 'SPACE',
        attacker: {
          faction: 'EL_NEN_JANOVET',
          units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
          abilities: { TF_UPGRADE_EXOTRIREME: { isEnabled: true, uses: 1 } },
        },
        defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
      })

      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ attacker: 0, defender: 0 })

      expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
      expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
      expect(t.defender.units.CRUISER).toHaveLength(1)
    },
  )

  it.forEachSide(
    'sacrifices the flagship first when it leads the priority list',
    () => {
      const t = combatTest({
        system: 'TF',
        mode: 'SPACE',
        attacker: {
          faction: 'EL_NEN_JANOVET',
          units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
          abilities: {
            TF_UPGRADE_EXOTRIREME: {
              isEnabled: true,
              uses: 1,
              sacrificePriority: [
                ['FLAGSHIP', true],
                ['DREADNOUGHT', true],
              ],
            },
          },
        },
        defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
      })

      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ attacker: 0, defender: 0 })

      expect(t.attacker.units.FLAGSHIP).toBeUndefined()
      expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
      expect(t.defender.units.CRUISER).toHaveLength(1)
    },
  )

  it.forEachSide('keeps the flagship when it is unchecked', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units: { FLAGSHIP: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: {
            isEnabled: true,
            uses: 1,
            sacrificePriority: [
              ['DREADNOUGHT', true],
              ['FLAGSHIP', false],
            ],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('offers the flagship in the sacrifice list, even while the card is off', () => {
    const setup = new CombatSetup()
    setup.setSystem('TF')
    setup.setFaction('attacker', 'EL_NEN_JANOVET')

    // Listed as if the card were on, so it can be set up before enabling.
    expect(sacrificeTypes(setup)).toEqual(['DREADNOUGHT', 'FLAGSHIP'])
    // Up to 5 dreadnoughts and the flagship may be sacrificed.
    expect(controls(setup)).toMatchObject({
      uses: { max: 6 },
      sacrificePriority: { visible: true },
    })

    // A custom order survives switching the card on and off.
    setCardParams(setup, {
      sacrificePriority: cardParams(setup).sacrificePriority.toReversed(),
    })
    setCardParams(setup, { isEnabled: true })
    setCardParams(setup, { isEnabled: false })

    expect(sacrificeTypes(setup)).toEqual(['FLAGSHIP', 'DREADNOUGHT'])

    // Without Janovet only the dreadnoughts carry the text, and a list with a
    // single option stays hidden.
    setup.setFaction('attacker', 'AVARICE_REX')

    expect(sacrificeTypes(setup)).toEqual(['DREADNOUGHT'])
    expect(controls(setup)).toMatchObject({
      uses: { max: 5 },
      sacrificePriority: { visible: false },
    })
  })
})
