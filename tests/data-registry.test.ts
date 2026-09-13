import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { createGameData } from '@/data/create-game-data'
import * as main from '@/data/main'
import * as tf from '@/data/tf'
import type { FactionAbilities, FactionDefinition, GameData } from '@/types'

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
        BASE: { ABILITIES: data => [...data.getAbilities('AGENT')] },
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
    factionDefinitions: { S: staticFaction, L: lazyOne, M: lazyTwo },
    baseUnits: {},
    sharedAbilities: [{ ability: techT, slot: 'TECHNOLOGY' }],
    FACTION_KEY_TO_SLOT: main.FACTION_KEY_TO_SLOT,
    unitSlot: main.unitSlot,
    SLOT_DISPLAY: main.SLOT_DISPLAY,
    SLOT_ORDER: main.SLOT_ORDER,
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
        factionDefinitions: {
          INVALID: {
            name: 'Invalid',
            units: {},
            abilities: { breakthrough: [agentA] },
          },
        },
        baseUnits: {},
        sharedAbilities: [],
        FACTION_KEY_TO_SLOT: tf.FACTION_KEY_TO_SLOT,
        unitSlot: tf.unitSlot,
        SLOT_DISPLAY: tf.SLOT_DISPLAY,
        SLOT_ORDER: tf.SLOT_ORDER,
      }),
    ).toThrow(
      'Faction ability group "breakthrough" on "INVALID" is not supported by TF',
    )
  })
})

describe('resolved game data', () => {
  it('has no lazy values left in either system', () => {
    for (const faction of [
      ...Object.values(main.factions),
      ...Object.values(tf.factions),
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
