import { describe, expect, it } from 'vitest'

import { makeUnitLocator, withRunningAbility } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID, type UnitType } from '@/types'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

function apolloSetup() {
  const setup = new CombatSetup('FULL')
  setup.setFaction('attacker', 'LAST_BASTION')
  setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'CRUISER', 2)
  setup.setAbilityParam('attacker', 'APOLLO', { isEnabled: true })
  return setup
}

describe('APOLLO', () => {
  it('leaves the hero unchosen until the player picks one', () => {
    const setup = apolloSetup()
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'DESTROYER', 1)
    expect(setup.abilities.attacker.APOLLO.heroUnit).toBeNull()
  })

  it('offers units that are only galvanized during combat as heroes', () => {
    const setup = apolloSetup()
    const ability = setup
      .getAvailableAbilities('attacker')
      .find(item => item.key === 'APOLLO')!
    const ctx = setup.getReadContext('attacker')
    const items = withRunningAbility(ctx, ability, () =>
      ctx.api.own.getUnitVariantsOptions('heroUnit'),
    )
    expect(items.map(item => item.value)).toContain(
      makeUnitLocator('CRUISER:Galvanized' as UnitType, SPACE_SURFACE_ID),
    )
  })

  it('stamps Hero subtype on the pre-galvanized target at combat construction', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 2]],
          },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    const cruisers = t.attacker.units.CRUISER!
    const heroes = cruisers.filter(u => u.subtypes?.includes('Hero'))
    expect(heroes).toHaveLength(1)
    // The Hero unit also keeps the Galvanized subtype
    expect(heroes[0].subtypes).toContain('Galvanized')
    // Exactly one non-Hero galvanized left
    const plainGalvanized = cruisers.filter(
      u => u.subtypes?.includes('Galvanized') && !u.subtypes?.includes('Hero'),
    )
    expect(plainGalvanized).toHaveLength(1)
  })

  it('does not stamp Hero when no matching galvanized unit exists', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['DESTROYER', 1]],
          },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    const heroAnywhere = [
      ...(t.attacker.units.CRUISER ?? []),
      ...(t.attacker.units.DESTROYER ?? []),
    ].some(u => u.subtypes?.includes('Hero'))
    expect(heroAnywhere).toBe(false)
  })

  it('fires when the Hero unit is destroyed — rolls dice at hero combat value', () => {
    // Attacker has 1 galvanized cruiser (Hero). Defender has 1 cruiser.
    // Attacker receives 1 hit → Hero dies → Apollo rolls 1 die at 7 at the
    // single defender cruiser.
    //   P(0 hits) = 0.6  → defender cruiser survives
    //   P(1 hit)  = 0.4  → defender cruiser destroyed
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // Apollo rolls [7, 1] → getDiceOutcomes returns 2 outcomes (0/1 hits).
    expect(branches).toHaveLength(2)

    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[1]).toBeCloseTo(0.6) // no hit
    expect(byRemaining[0]).toBeCloseTo(0.4) // 1 hit destroys defender cruiser
  })

  it('per-variant destruction: a hit on DREADNOUGHT group does not destroy DREADNOUGHT:Cavalry and vice versa', () => {
    // Attacker: Hero galvanized cruiser (combat 7). Defender: 1 DREADNOUGHT
    // + 1 DREADNOUGHT via Cavalry variant. Attacker takes 1 hit → Hero dies
    // → Apollo rolls 2 dice groups: [7,1] for 'DREADNOUGHT', [7,1] for
    // 'DREADNOUGHT:Cavalry'. Total 4 outcomes (0/0, 0/1, 1/0, 1/1).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
          UNIT_PRIORITY: {
            spaceUnitPriority: [['CRUISER:Galvanized,Hero'], ['CRUISER']],
          },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DREADNOUGHT' },
        },
      },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // 2 independent d7 rolls → 2 groups × 2 outcomes = 4 branches.
    expect(branches).toHaveLength(4)

    // Verify: across all branches, the variant-split holds — hit on Cavalry
    // group destroys the Cavalry DN, hit on base group destroys base DN.
    // Check the branch where both groups hit (cavalry destroyed + base destroyed).
    const countByVariant = (
      data: (typeof branches)[number]['state']['data']['defender'],
      key: string,
    ) => {
      const match = (id: string) => data.unitType[id] === key
      let total = 0
      for (const id of data.participatingUnits) if (match(id)) total++
      for (const id of data.nonParticipatingUnits) if (match(id)) total++
      return total
    }
    const bothDead = branches.find(
      b =>
        countByVariant(b.state.data.defender, 'DREADNOUGHT') === 0 &&
        countByVariant(b.state.data.defender, 'DREADNOUGHT:Cavalry') === 0,
    )
    expect(bothDead).toBeDefined()
    expect(bothDead!.probability).toBeCloseTo(0.4 * 0.4) // both hit

    // Branch where base hit but cavalry survived
    const baseDeadCavalryAlive = branches.find(
      b =>
        countByVariant(b.state.data.defender, 'DREADNOUGHT') === 0 &&
        countByVariant(b.state.data.defender, 'DREADNOUGHT:Cavalry') === 1,
    )
    expect(baseDeadCavalryAlive).toBeDefined()
    expect(baseDeadCavalryAlive!.probability).toBeCloseTo(0.4 * 0.6)
  })
})
