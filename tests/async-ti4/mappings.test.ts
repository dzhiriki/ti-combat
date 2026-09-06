import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { locationAreaLabel } from '@/async-ti4/locations'
import {
  ABILITY_BY_TECH,
  ABILITY_BY_TF_UNIT,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
  UNIT_UPGRADE_BY_TECH,
} from '@/async-ti4/mappings'
import { PLANET_NAMES } from '@/async-ti4/planet-names'
import { WebDataSchema } from '@/async-ti4/types'
import { UNIT_TYPES } from '@/constants/units'
import technology from '@/data/abilities/technology'
import factions from '@/data/faction'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'

// These tables are the seam with a project we don't control, and every value
// on the right-hand side is one of our own keys. Renaming an ability or a
// faction here would otherwise break the import silently — nothing throws, the
// card simply stops arriving. Assert each target still resolves.
function loadFixture(name: string) {
  return WebDataSchema.parse(
    JSON.parse(
      readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8'),
    ),
  )
}
const ti4Data = loadFixture('ti4-game.json')
const tfData = loadFixture('twilights-fall-game.json')
const activeData = loadFixture('active-combat.json')

const abilityKeys = new Set(getAllAbilities().map(a => a.key))
const factionKeys = new Set(Object.keys(factions))
const unitTypes = new Set<string>(UNIT_TYPES)

describe('AsyncTI4 mapping tables', () => {
  it('maps only to factions that exist', () => {
    for (const [asyncId, key] of Object.entries(FACTION_BY_ASYNC_ID)) {
      expect(factionKeys, `${asyncId} → ${key}`).toContain(key)
    }
  })

  it('maps only to unit types that exist', () => {
    for (const [asyncId, type] of Object.entries(UNIT_TYPE_BY_ASYNC_ID)) {
      expect(unitTypes, `${asyncId} → ${type}`).toContain(type)
    }
    for (const [tech, type] of Object.entries(UNIT_UPGRADE_BY_TECH)) {
      expect(unitTypes, `${tech} → ${type}`).toContain(type)
    }
  })

  it('maps only to abilities that exist', () => {
    for (const [alias, mapped] of Object.entries({
      ...ABILITY_BY_TECH,
      ...ABILITY_BY_TF_UNIT,
    })) {
      for (const key of typeof mapped === 'string' ? [mapped] : mapped) {
        expect(abilityKeys, `${alias} → ${key}`).toContain(key)
      }
    }
  })

  it('reaches every technology the calculator models as a card', () => {
    // Both the generic technology deck and each faction's own technologies.
    // A card modelled here but unreachable from any alias can never be
    // imported, which is exactly how Valkyrie Particle Weave went missing.
    const mapped = new Set(
      Object.values(ABILITY_BY_TECH).flatMap(v =>
        typeof v === 'string' ? [v] : [...v],
      ),
    )
    const modelled = [
      ...technology.map(a => a.key),
      ...Object.values(factions).flatMap(f =>
        (f.abilities?.technology ?? []).map(a => a.key),
      ),
    ]
    expect([...new Set(modelled)].filter(k => !mapped.has(k))).toEqual([])
  })

  it('covers every faction the calculator models', () => {
    // A faction here with no AsyncTI4 id can never be imported. Catches a new
    // faction being added to the calculator without an id to reach it by.
    const mapped = new Set(Object.values(FACTION_BY_ASYNC_ID))
    expect([...factionKeys].filter(k => !mapped.has(k))).toEqual([])
  })

  it('covers every TF unit upgrade the calculator models', () => {
    const mapped = new Set(Object.values(ABILITY_BY_TF_UNIT))
    const modelled = [...abilityKeys].filter(k => k.startsWith('TF_UPGRADE_'))
    expect(modelled.filter(k => !mapped.has(k))).toEqual([])
  })
})

describe('payload tolerance', () => {
  it('survives upstream mangling anything that is not load-bearing', () => {
    // A battle needs the players and the map. Everything else — labels, the
    // active combat, a stack's damage breakdown — should degrade to absent
    // rather than take the whole import down with it.
    const mangled = {
      versionSchema: 'seven',
      gameName: 42,
      gameRound: { nested: true },
      gameState: 'not an object',
      playerData: [
        {
          faction: 'sol',
          color: [],
          techs: 'amd',
          unitsOwned: null,
          galvanizeTokensReinf: 'four',
        },
      ],
      tileUnitData: {
        '000': {
          space: {
            sol: [
              {
                entityType: 'unit',
                entityId: 'ff',
                count: 2,
                unitStates: 'broken',
              },
            ],
          },
          planets: null,
        },
      },
    }

    const parsed = WebDataSchema.safeParse(mangled)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.versionSchema).toBeNull()
    expect(parsed.data?.gameState).toBeNull()
    expect(parsed.data?.tileUnitData['000'].space?.sol[0].count).toBe(2)
  })

  it('still refuses a payload with no players or map', () => {
    expect(WebDataSchema.safeParse({ playerData: [] }).success).toBe(false)
    expect(WebDataSchema.safeParse({ tileUnitData: {} }).success).toBe(false)
  })
})

describe('planet names', () => {
  it('turns squashed keys into printed names', () => {
    // `tileUnitData` keys planets by a squashed identifier, which is no use in
    // a list someone reads: `mrte` has to come out as Mecatol Rex.
    expect(locationAreaLabel({ planet: 'mrte' })).toBe('Mecatol Rex')
    expect(locationAreaLabel({ planet: 'meharxull' })).toBe('Mehar Xull')
    expect(locationAreaLabel({ planet: 'rigelii' })).toBe('Rigel II')
    // Homebrew reskins reuse other planets' holder keys; the real planet wins.
    expect(locationAreaLabel({ planet: 'mirage' })).toBe('Mirage')
  })

  it('falls back to the key rather than showing nothing', () => {
    expect(locationAreaLabel({ planet: 'notaplanet' })).toBe('Notaplanet')
    expect(locationAreaLabel({})).toBe('Space')
  })

  it('names every planet the sample games use', () => {
    for (const data of [ti4Data, tfData, activeData]) {
      for (const tile of Object.values(data.tileUnitData)) {
        for (const planet of Object.keys(tile.planets ?? {})) {
          expect(PLANET_NAMES[planet], `no name for "${planet}"`).toBeDefined()
        }
      }
    }
  })
})
