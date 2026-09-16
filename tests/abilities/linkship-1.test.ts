import { describe, expect, it } from 'vitest'

import { SPACE_SURFACE_ID } from '@/types'
import { getGameData } from '@/utils/get-game-data'

import { combatTest } from '../utils/combat-test'

describe('Linkship registration', () => {
  it('exposes one ability with both unit texts in its tooltip', () => {
    const abilities = getGameData('TI4').getAvailableAbilities(
      'attacker',
      'RAL_NEL',
    )
    const linkships = abilities.filter(ability =>
      ability.key.startsWith('LINKSHIP'),
    )

    expect(linkships).toHaveLength(1)
    expect(linkships[0]).toMatchObject({ key: 'LINKSHIP', name: 'Linkship' })
    expect(linkships[0]?.description).toContain('Linkship I:')
    expect(linkships[0]?.description).toContain('Linkship II:')
    expect(linkships[0]?.warning).toContain(
      'all Ral Nel structures are placed in the space area',
    )
    expect(linkships[0]?.params).not.toHaveProperty('structures')
    expect(linkships[0]?.uiConfig).toBeUndefined()
  })
})

describe.forEachSide('LINKSHIP I', () => {
  it('adds SC dice for each linkship up to structures count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 2, PDS: 2 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 2 linkships, 2 PDS structures → 2 DESTROYER SC dice groups [6, 1]
    expect(pool.defender.LINKSHIP).toHaveLength(2)
    expect(pool.defender).toContainDice('LINKSHIP', [6, 1])
  })

  it('is capped by structures count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 3, PDS: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 3 linkships but only 1 PDS structure → 1 SC dice group
    expect(pool.defender.LINKSHIP).toHaveLength(1)
  })

  it('is capped by linkship count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, PDS: 3 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 1 linkship, 3 PDS structures → 1 SC dice group
    expect(pool.defender.LINKSHIP).toHaveLength(1)
  })

  it('uses best SC source first then falls back', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: {
            DESTROYER: 2,
            PDS: 1,
            SPACE_DOCK: 1,
          },
        },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 2 linkships: first uses Space Dock [5, 2], second uses PDS [6, 1]
    expect(pool.defender.LINKSHIP).toHaveLength(2)
    expect(pool.defender).toContainDice('LINKSHIP', [5, 2])
    expect(pool.defender).toContainDice('LINKSHIP', [6, 1])
  })

  it('reads structures directly from the space area', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, PDS: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()
    const pdsInSpace = [
      ...t.state.defender.surfaceUnits[SPACE_SURFACE_ID],
    ].filter(id => t.state.defender.unitType[id] === 'PDS')

    expect(pdsInSpace).toHaveLength(1)
    expect(pool.defender.LINKSHIP).toHaveLength(1)
    expect(pool.defender).toContainDice('LINKSHIP', [6, 1])
  })

  it('uses best SC source among structures', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, SPACE_DOCK: 1 },
        },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship uses Space Dock's SC [5, 2] (better than PDS [6, 1])
    expect(pool.defender).toContainDice('LINKSHIP', [5, 2])
  })
})
