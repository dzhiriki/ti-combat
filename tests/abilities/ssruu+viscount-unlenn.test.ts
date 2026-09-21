import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SSRUU + VISCOUNT_UNLENN', () => {
  it('Viscount and Ssruu buff two different ship types — each gains +1 die', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
            unitType: 'DESTROYER',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Cruiser base [7, 1] → [7, 2] from Viscount
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
    // Destroyer base [9, 1] → [9, 2] from Ssruu copy
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
  })

  it('Viscount and Ssruu buff two different ships — each gains +1 die', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
            unitType: 'CRUISER',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Cruiser base [7, 1] → [7, 2] from Viscount
    expect(pool.attacker).toContainDice('CRUISER', [7, 2], [7, 2])
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
  })

  it('Viscount subtype declared by each ability with distinct source tags', () => {
    // With both agents active and targeting the same ship, VISCOUNT is
    // declared twice in side metadata — once by Viscount (source
    // 'VISCOUNT_UNLENN') and once by Ssruu (source 'SSRUU'). Viscount's UI
    // filters its own declarations via excludeSubtypeSource so Ssruu's entry
    // stays visible, letting the user stack Viscount on Viscount-boosted ships.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
            unitType: 'CRUISER',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    const viscountDecls = (t.state.attacker.declaredSubtypes ?? []).filter(
      subtype => subtype.name === 'Viscount',
    )
    expect(viscountDecls).toHaveLength(2)
    expect(viscountDecls.map(d => d.source).sort()).toEqual([
      'SSRUU',
      'VISCOUNT_UNLENN',
    ])
  })

  it('Viscount and Ssruu buff single ship — it gains +2 dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
            unitType: 'CRUISER:Viscount',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Cruiser base [7, 1] → [7, 2] from Viscount
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
  })
})
