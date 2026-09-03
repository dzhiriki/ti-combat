import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import * as main from '@/data/main'
import { resolveFactions } from '@/data/registry'
import * as tf from '@/data/tf'
import type { FactionAbilities, FactionDefinition } from '@/types'

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

describe('resolveFactions', () => {
  const staticAbilities: FactionAbilities = { agent: [agentA] }
  const staticFaction: FactionDefinition = {
    name: 'Static',
    units: {},
    abilities: staticAbilities,
  }
  const lazyOne: FactionDefinition = {
    name: 'Lazy one',
    units: {
      FLAGSHIP: {
        BASE: { ABILITIES: registry => [...registry.getAbilities('AGENT')] },
      },
    },
    abilities: registry => ({
      technology: [...registry.getAbilities('TECHNOLOGY')],
    }),
  }
  let seenByTwo: string[] = []
  const lazyTwo: FactionDefinition = {
    name: 'Lazy two',
    units: {},
    abilities: registry => {
      seenByTwo = Object.keys(registry.factions)
      return {}
    },
  }

  const resolved = resolveFactions(
    'TI4',
    {},
    [{ ability: techT, slot: 'TECHNOLOGY' }],
    { S: staticFaction, L: lazyOne, M: lazyTwo },
  )

  it('resolves lazy abilities and unit ABILITIES from the registry', () => {
    expect(resolved.L.abilities?.technology).toEqual([techT])
    expect(resolved.L.units.FLAGSHIP?.BASE.ABILITIES).toEqual([agentA])
  })

  it('exposes only static factions to lazy ones', () => {
    expect(seenByTwo).toEqual(['S'])
  })

  it('omits icon on a resolved lazy faction that declares none', () => {
    expect('icon' in resolved.M).toBe(false)
  })

  it('keeps definition order and passes static factions through', () => {
    expect(Object.keys(resolved)).toEqual(['S', 'L', 'M'])
    expect(resolved.S.abilities?.agent).toBe(staticAbilities.agent)
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
