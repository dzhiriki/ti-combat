import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { createGameData } from '@/data/create-game-data'
import { SLOTS as MAIN_SLOTS } from '@/data/main/ability-slots'
import { SLOTS as TF_SLOTS } from '@/data/tf/ability-slots'
import type { FactionAbilities, FactionDefinition, GameData } from '@/types'
import { getGameData } from '@/utils/get-game-data'

const agentA: Ability = {
  key: 'AGENT_A',
  name: 'Agent A',
  params: { isEnabled: false, uses: 1 },
  invoke: [],
}
const techT: Ability = {
  key: 'TECH_T',
  name: 'Tech T',
  params: { isEnabled: false, uses: Infinity },
  invoke: [],
}

describe('GameData faction resolution', () => {
  const staticAbilities: FactionAbilities = { agent: [agentA] }
  const staticFaction: FactionDefinition = {
    name: 'Static',
    units: {},
    abilities: staticAbilities,
  }
  let resolvingGameData: GameData | undefined
  const lazyOne: FactionDefinition = {
    name: 'Lazy one',
    units: {
      FLAGSHIP: {
        BASE: { ABILITIES: data => [...data.getAbilities('FACTION_AGENT')] },
      },
    },
    abilities: data => {
      resolvingGameData = data
      return { technology: [...data.getAbilities('TECHNOLOGY')] }
    },
  }
  let seenByTwo: string[] = []
  const lazyTwo: FactionDefinition = {
    name: 'Lazy two',
    units: {},
    abilities: data => {
      seenByTwo = Object.keys(data.factions)
      return {}
    },
  }

  const gameData = createGameData({
    id: 'TI4',
    label: 'Test',
    factions: { S: staticFaction, L: lazyOne, M: lazyTwo },
    units: {},
    abilities: { TECHNOLOGY: [techT] },
    slots: MAIN_SLOTS,
  })
  const resolved = gameData.factions

  it('resolves lazy abilities and unit ABILITIES from GameData', () => {
    expect(resolved.L.abilities?.technology).toEqual([techT])
    expect(resolved.L.units.FLAGSHIP?.BASE.ABILITIES).toEqual([agentA])
  })

  it('passes the exported GameData entity to lazy definitions', () => {
    expect(resolvingGameData).toBe(gameData)
  })

  it('exposes only static factions while lazy definitions resolve', () => {
    expect(seenByTwo).toEqual(['S'])
  })

  it('omits icon on a resolved lazy faction that declares none', () => {
    expect('icon' in resolved.M).toBe(false)
  })

  it('keeps definition order and passes static factions through', () => {
    expect(Object.keys(resolved)).toEqual(['S', 'L', 'M'])
    expect(resolved.S.abilities?.agent).toBe(staticAbilities.agent)
  })

  it('rejects faction ability groups the system does not declare', () => {
    expect(() =>
      createGameData({
        id: 'TF',
        label: 'Test',
        factions: {
          INVALID: {
            name: 'Invalid',
            units: {},
            abilities: { breakthrough: [agentA] },
          },
        },
        units: {},
        abilities: {},
        slots: TF_SLOTS,
      }),
    ).toThrow(
      'Faction ability group "breakthrough" on "INVALID" is not supported by TF',
    )
  })
})

describe('slot config', () => {
  const heroA: Ability = {
    key: 'HERO_A',
    name: 'Hero A',
    params: { isEnabled: false, uses: 1 },
    invoke: [],
  }
  const promissoryA: Ability = {
    key: 'PROMISSORY_A',
    name: 'Promissory A',
    params: { isEnabled: false, uses: 1 },
    invoke: [],
  }
  const unitAbility = (key: string): Ability => ({
    key,
    name: key,
    headerUI: 'isEnabled',
    params: { isEnabled: false, uses: 1 },
    invoke: [],
  })

  const agentB: Ability = {
    key: 'AGENT_B',
    name: 'Agent B',
    params: { isEnabled: false, uses: 1 },
    invoke: [],
  }
  const promissoryB: Ability = {
    key: 'PROMISSORY_B',
    name: 'Promissory B',
    params: { isEnabled: false, uses: 1 },
    invoke: [],
  }

  const gameData = createGameData({
    id: 'TI4',
    label: 'Test',
    factions: {
      A: {
        name: 'A',
        units: {
          FLAGSHIP: { BASE: { ABILITIES: [unitAbility('FLAGSHIP_A')] } },
          CRUISER: { BASE: { ABILITIES: [unitAbility('CRUISER_A')] } },
        },
        abilities: {
          hero: [heroA],
          agent: [agentA],
          promissory: [promissoryA],
        },
      },
      B: {
        name: 'B',
        units: {},
        abilities: { agent: [agentB], promissory: [promissoryB] },
      },
      NEUTRAL: { name: 'Neutral', units: {} },
    },
    units: {},
    abilities: {},
    slots: MAIN_SLOTS,
  })
  const shownTo = (factionKey: string, key: string) =>
    gameData
      .getAvailableAbilities('attacker', factionKey)
      .filter(reg => reg.key === key)
  const slotsOf = (key: string): string[] =>
    shownTo('A', key).map(reg => reg.slot)
  const categoriesOf = (key: string): string[] =>
    shownTo('A', key).map(
      reg => `${reg.display.category}/${reg.display.subcategory ?? '-'}`,
    )

  it('renders an OWN group under the faction', () => {
    expect(slotsOf('HERO_A')).toEqual(['FACTION_HERO'])
    expect(categoriesOf('HERO_A')).toEqual(['FACTION/HERO'])
  })

  it('collects every faction into one slot and splits it by strategy', () => {
    // One FACTION_AGENT slot: the faction's own agent renders under FACTION,
    // everyone else's in the shared AGENT list — never both.
    expect(slotsOf('AGENT_A')).toEqual(['FACTION_AGENT'])
    expect(categoriesOf('AGENT_A')).toEqual(['FACTION/AGENT'])
    expect(slotsOf('AGENT_B')).toEqual(['FACTION_AGENT'])
    expect(categoriesOf('AGENT_B')).toEqual(['AGENT/-'])
  })

  it('shows an ALL slot to every faction, its owner included', () => {
    expect(categoriesOf('PROMISSORY_A')).toEqual(['PROMISSORY/-'])
    expect(categoriesOf('PROMISSORY_B')).toEqual(['PROMISSORY/-'])
  })

  it('registers a faction unit ability under the slot named after its type', () => {
    expect(slotsOf('CRUISER_A')).toEqual(['FACTION_CRUISER'])
    expect(slotsOf('FLAGSHIP_A')).toEqual(['FACTION_FLAGSHIP'])
  })

  it('gives every slot of a multi-slot entry its title and order', () => {
    // The unit slots listed together under FACTION/UNIT.
    expect(shownTo('A', 'CRUISER_A')[0]?.display).toEqual({
      category: 'FACTION',
      subcategory: 'UNIT',
      order: 9,
      icon: true,
    })
    // Flagships and mechs keep their own sub-headers.
    expect(shownTo('A', 'FLAGSHIP_A')[0]?.display).toEqual({
      category: 'FACTION',
      subcategory: 'FLAGSHIP',
      order: 2,
      icon: true,
    })
    expect(shownTo('A', 'HERO_A')[0]?.display).toEqual({
      category: 'FACTION',
      subcategory: 'HERO',
      order: 5,
      icon: true,
    })
  })

  it('drops the card icon where the config says the header already names the faction', () => {
    // Own agent under FACTION: icon off. Someone else's agent in the shared
    // AGENT list: icon on, it is the only thing saying whose it is.
    expect(shownTo('A', 'AGENT_A')[0]?.display.icon).toBe(false)
    expect(shownTo('A', 'AGENT_B')[0]?.display.icon).toBe(true)
  })

  it('hides `neutral: false` entries from NEUTRAL only', () => {
    // Notes are hidden from Neutral; other factions' agents are not.
    expect(shownTo('NEUTRAL', 'PROMISSORY_A')).toEqual([])
    expect(shownTo('NEUTRAL', 'AGENT_B').map(reg => reg.slot)).toEqual([
      'FACTION_AGENT',
    ])
    expect(shownTo('B', 'PROMISSORY_A').map(reg => reg.slot)).toEqual([
      'FACTION_PROMISSORY',
    ])
  })

  it('rejects an ability whose slot no entry shows', () => {
    // A shared deck under a slot the config never mentions…
    expect(() =>
      createGameData({
        id: 'TF',
        label: 'Test',
        factions: {},
        units: {},
        abilities: { NOPE: [heroA] },
        slots: TF_SLOTS,
      }),
    ).toThrow('Slot "NOPE" of "HERO_A" is not declared by TF')
    // …and a faction unit ability whose unit type has no slot in this system.
    expect(() =>
      createGameData({
        id: 'TF',
        label: 'Test',
        factions: {
          X: {
            name: 'X',
            units: {
              CRUISER: { BASE: { ABILITIES: [unitAbility('CRUISER_X')] } },
            },
          },
        },
        units: {},
        abilities: {},
        slots: TF_SLOTS,
      }),
    ).toThrow('Slot "FACTION_CRUISER" of "CRUISER_X" is not declared by TF')
  })

  it('rejects a slot declared twice', () => {
    expect(() =>
      createGameData({
        id: 'TI4',
        label: 'Test',
        factions: {},
        units: {},
        abilities: {},
        slots: [
          { title: 'General', slot: 'GENERAL' },
          { title: 'Also general', slot: 'GENERAL' },
        ],
      }),
    ).toThrow('Duplicate slot "GENERAL" in slot config')
  })
})

describe('resolved game data', () => {
  it('has no lazy values left in either system', () => {
    for (const faction of [
      ...Object.values(getGameData('TI4').factions),
      ...Object.values(getGameData('TF').factions),
    ]) {
      expect(typeof faction.abilities).not.toBe('function')
      for (const unitDef of Object.values(faction.units)) {
        if (!unitDef) continue
        for (const stats of [unitDef.BASE, unitDef.UPGRADED]) {
          if (!stats) continue
          expect(typeof stats.ABILITIES).not.toBe('function')
        }
      }
    }
  })
})
