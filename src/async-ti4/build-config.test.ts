import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import { buildAbilityLookup } from '@/hooks/combat-setup/validation'

import { buildImportConfig } from './build-config'
import { parseGameId } from './fetch-game'
import { listBattleLocations } from './locations'
import { type BattleLocation, WebDataSchema } from './types'

// A real AsyncTI4 game (sample-ti4), trimmed to five tiles that between them
// cover damaged and galvanized stacks, structures under a space battle, and
// the tokens and attachments that share the units' shape.
const data = WebDataSchema.parse(
  JSON.parse(
    readFileSync(new URL('./game-fixture.json', import.meta.url), 'utf-8'),
  ),
)

const abilityLookup = buildAbilityLookup(getAllAbilities())
const locations = listBattleLocations(data)

function locationAt(id: string): BattleLocation {
  const found = locations.find(l => l.id === id)
  if (!found) throw new Error(`No location "${id}" in fixture`)
  return found
}

function importAt(id: string, attacker: string, defender: string) {
  return buildImportConfig(
    data,
    { location: locationAt(id), attacker, defender },
    abilityLookup,
  )
}

describe('parseGameId', () => {
  it('accepts a bare id, a web link, and rejects anything else', () => {
    expect(parseGameId('sample-ti4')).toBe('sample-ti4')
    expect(parseGameId('https://asyncti4.com/game/sample-ti4')).toBe('sample-ti4')
    expect(parseGameId(' https://asyncti4.com/game/sample-ti4/map ')).toBe(
      'sample-ti4',
    )
    expect(parseGameId('not a game')).toBeNull()
    expect(parseGameId('')).toBeNull()
  })
})

describe('listBattleLocations', () => {
  it('lists a system and its planets separately', () => {
    expect(locationAt('frac4').mode).toBe('SPACE')
    expect(locationAt('frac4/styx').mode).toBe('GROUND')
  })

  it('ignores tokens and attachments when deciding who is present', () => {
    // Neutral holds only a Mirage token in 212 and only attachments on hercalor.
    expect(locationAt('212').factions).toEqual(['sardakk'])
    expect(locationAt('317/hercalor').factions).toEqual(['bastion'])
  })

  it('sorts contested locations first', () => {
    const firstUncontested = locations.findIndex(l => l.factions.length < 2)
    const lastContested = locations.findLastIndex(l => l.factions.length > 1)
    expect(lastContested).toBeLessThan(firstUncontested)
  })
})

describe('buildImportConfig', () => {
  it('maps factions, units and combat techs for a space battle', () => {
    const { config } = importAt('frac4', 'cabal', 'deepwrought')

    expect(config.af).toBe('VUILRAITH_CABAL')
    expect(config.df).toBe('DEEPWROUGHT_SCHOLARATE')
    expect(config.m).toBe('S')
    expect(config.au.WAR_SUN).toEqual([1, 0])
    expect(config.au.CRUISER).toEqual([2, 0])
    expect(config.au.FIGHTER).toEqual([3, 0])
    // Assault Cannon is researched by both sides in this game.
    expect(config.aa.ASSAULT_CANNON).toEqual({ isEnabled: true })
    expect(config.da.ASSAULT_CANNON).toEqual({ isEnabled: true })
  })

  it('carries damaged and galvanized stacks over as pre-set unit state', () => {
    // The Cabal war sun at frac4 is sustained: unitStates [0, 1, 0, 0].
    const { config } = importAt('frac4', 'cabal', 'deepwrought')
    expect(config.aa.PRE_DAMAGED).toEqual({ damagedUnits: [['WAR_SUN', 1]] })

    // Two Bastion cruisers at 104, one of them galvanized: [1, 0, 1, 0].
    const bastion = importAt('104', 'bastion', 'sardakk').config
    expect(bastion.au.CRUISER).toEqual([2, 1]) // Cruiser II is researched
    expect(bastion.aa.PRE_GALVANIZED).toEqual({
      galvanizedUnits: [['CRUISER', 1]],
      reinforcementTokens: 4,
    })
  })

  it('pulls structures on the system planets into a space battle', () => {
    // Sardakk holds the space at 106; Bastion has only 2 PDS down on Lodor.
    const { config } = importAt('106', 'sardakk', 'bastion')
    expect(config.au.DREADNOUGHT).toEqual([2, 1]) // Exotrireme II
    expect(config.du.PDS).toEqual([2, 1]) // PDS II
    expect(config.du.INFANTRY).toBeUndefined()
  })

  it('takes every unit on the planet for a ground battle', () => {
    const { config } = importAt('106/lodor', 'sardakk', 'bastion')
    expect(config.m).toBe('G')
    expect(config.du.INFANTRY).toEqual([5, 0])
    expect(config.du.MECH).toEqual([1, 0])
    expect(config.du.PDS).toEqual([2, 1])
    expect(config.da.PRE_GALVANIZED).toEqual({
      galvanizedUnits: [['MECH', 1]],
      reinforcementTokens: 4,
    })
    // Magen Defense Grid ΩΩ is a ground card Bastion holds.
    expect(config.da.MAGEN_DEFENSE_GRID).toEqual({ isEnabled: true })
  })

  it('records researched upgrades for units the side has none of here', () => {
    const { config } = importAt('106', 'sardakk', 'bastion')
    // Sardakk has Cruiser II but no cruisers at 106.
    expect(config.au.CRUISER).toEqual([0, 1])
  })

  it('stays quiet when everything maps', () => {
    expect(importAt('frac4', 'cabal', 'deepwrought').notes).toEqual([])
  })

  it('reports units and cards it could not bring across', () => {
    // Give the Cabal a monument (no combat model) and the pre-Omega X-89
    // (a different card from the one implemented here).
    const doctored = structuredClone(data)
    doctored.tileUnitData.frac4.space!.cabal.push({
      entityType: 'unit',
      entityId: 'monument',
      count: 1,
      unitStates: null,
    })
    doctored.playerData
      .find(p => p.faction === 'cabal')!
      .techs!.push('x89_base')

    const { notes } = buildImportConfig(
      doctored,
      {
        location: locationAt('frac4'),
        attacker: 'cabal',
        defender: 'deepwrought',
      },
      abilityLookup,
    )
    expect(notes).toHaveLength(2)
    expect(notes.join(' ')).toContain('monument')
    expect(notes.join(' ')).toContain(
      'X-89 Bacterial Weapon (pre-\u03a9 printing)',
    )
  })
})
