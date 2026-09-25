import { describe, expect, it } from 'vitest'

import { AbilityContext } from '@/combat/abilities-engine/api/ability-api'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import {
  UnitLocatorSchema,
  type SurfaceId,
  type UnitLocator,
  type UnitType,
  type UnitVariantId,
} from '@/types'

import { parseUnitLocator } from './parse-unit-locator'
import {
  isValidUnitLocator,
  locatorWithSubtype,
  makeUnitLocator,
  matchesUnitList,
  matchesUnitLocator,
  unitLocatorRank,
} from './unit-locator'
import { getVariantDisplayName, makeVariantId } from './unit-variant'

const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId
const CAVALRY = 'Cavalry' as UnitVariantId
const GALVANIZED = 'Galvanized' as UnitVariantId
const VARIANT = makeVariantId('MECH', [CAVALRY, GALVANIZED])

describe('unit locators', () => {
  it.each([
    ['MECH', 'MECH', []],
    ['MECH:Cavalry', 'MECH', ['Cavalry']],
    ['MECH:Galvanized,Cavalry', 'MECH', ['Galvanized', 'Cavalry']],
  ])(
    'parses legacy variant %s without changing subtype order',
    (value, baseType, subtypes) => {
      expect(parseUnitLocator(value as string)).toEqual({
        unitType: value,
        baseType,
        subtypes,
        surfaceId: undefined,
      })
    },
  )

  it('decodes a qualified compound variant while preserving the wire format', () => {
    const surface = 'planet /,~%:β' as SurfaceId
    const locator = makeUnitLocator(VARIANT, surface)
    expect(locator).toBe(
      '@planet%20%2F%2C%7E%25%3A%CE%B2/MECH%3ACavalry%2CGalvanized',
    )
    expect(parseUnitLocator(locator)).toEqual({
      unitType: VARIANT,
      baseType: 'MECH',
      subtypes: ['Cavalry', 'Galvanized'],
      surfaceId: surface,
    })
    expect(UnitLocatorSchema.safeParse(locator).success).toBe(true)
  })

  it('keeps cached locations separate from plain variant keys', () => {
    const plain = parseUnitLocator(VARIANT)
    const first = parseUnitLocator(makeUnitLocator(VARIANT, P1))
    const second = parseUnitLocator(makeUnitLocator(VARIANT, P2))
    expect(parseUnitLocator(makeUnitLocator(VARIANT, P1))).toBe(first)
    expect(first.surfaceId).toBe(P1)
    expect(second.surfaceId).toBe(P2)
    expect(plain.surfaceId).toBeUndefined()
  })

  it.each(['@broken', '@/MECH', '@%/MECH', '@planet-1/%'])(
    'rejects malformed encoding %s',
    value => {
      expect(() => parseUnitLocator(value)).toThrow()
      expect(isValidUnitLocator(value)).toBe(false)
      expect(UnitLocatorSchema.safeParse(value).success).toBe(false)
    },
  )

  it('keeps external validation separate from decoding', () => {
    expect(parseUnitLocator('@planet-1/UNKNOWN').baseType).toBe('UNKNOWN')
    expect(isValidUnitLocator('@planet-1/UNKNOWN')).toBe(false)
    expect(isValidUnitLocator('@planet-1/')).toBe(false)
    // Shared list schemas also accept legacy non-unit choices.
    expect(UnitLocatorSchema.safeParse('START_OF_COMBAT').success).toBe(true)
  })

  it('adds subtypes without losing the surface or mutating cached components', () => {
    const original = makeUnitLocator(makeVariantId('MECH', [GALVANIZED]), P2)
    const parsed = parseUnitLocator(original)
    const next = locatorWithSubtype(original, CAVALRY)
    expect(next).toBe(makeUnitLocator(VARIANT, P2))
    expect(parsed.subtypes).toEqual(['Galvanized'])
    expect(locatorWithSubtype('MECH', CAVALRY)).toBe('MECH:Cavalry')
    expect(getVariantDisplayName(parseUnitLocator(next).unitType)).toBe(
      'Mech (Cavalry, Galvanized)',
    )
  })

  it('matches exact variants and variant supersets only on the selected surface', () => {
    const side = {
      unitType: { a: VARIANT, b: VARIANT },
      unitSurface: { a: P1, b: P2 },
    }
    expect(matchesUnitLocator(side, 'a', makeUnitLocator(VARIANT, P1))).toBe(
      true,
    )
    expect(matchesUnitLocator(side, 'b', makeUnitLocator(VARIANT, P1))).toBe(
      false,
    )
    const parent = makeUnitLocator(makeVariantId('MECH', [CAVALRY]), P1)
    expect(matchesUnitLocator(side, 'a', parent)).toBe(false)
    expect(matchesUnitLocator(side, 'a', parent, true)).toBe(true)
    expect(matchesUnitLocator(side, 'b', parent, true)).toBe(false)
    expect(matchesUnitLocator(side, 'b', 'MECH', true)).toBe(true)
  })

  it('matches a unit list like getFlat + matchesUnitLocator', () => {
    const side = {
      unitType: {
        a: VARIANT,
        b: VARIANT,
        c: 'CRUISER' as UnitType,
        d: 'DESTROYER' as UnitType,
      },
      unitSurface: { a: P1, b: P2, c: P1, d: P1 },
    }
    const list: [UnitLocator, boolean | number][] = [
      [makeUnitLocator(VARIANT, P1), true],
      ['CRUISER', true],
      ['DESTROYER', false],
      [makeUnitLocator('MECH', P2), 0],
    ]
    for (const id of ['a', 'b', 'c', 'd', 'missing']) {
      for (const includeVariants of [false, true]) {
        const expected = list.some(
          ([key, value]) =>
            value !== false &&
            value !== 0 &&
            matchesUnitLocator(side, id, key, includeVariants),
        )
        expect(matchesUnitList(side, id, list, includeVariants)).toBe(expected)
      }
    }
    expect(matchesUnitList(side, 'a', list)).toBe(true)
    expect(matchesUnitList(side, 'b', list)).toBe(false)
    expect(matchesUnitList(side, 'b', list, true)).toBe(false)
    expect(matchesUnitList(side, 'b', [['MECH']], true)).toBe(true)
    expect(matchesUnitList(side, 'd', list)).toBe(false)
  })

  it('ranks an exact locator before its surface base and legacy fallback', () => {
    const ranks = new Map<string, number>([
      ['MECH', 0],
      [VARIANT, 1],
      [makeUnitLocator('MECH', P1), 2],
      [makeUnitLocator(VARIANT, P2), 3],
    ])
    expect(unitLocatorRank(ranks, VARIANT, P1)).toBe(2)
    expect(unitLocatorRank(ranks, VARIANT, P2)).toBe(3)
    expect(unitLocatorRank(ranks, VARIANT)).toBe(1)
  })

  it('resolves stats through raw instance IDs and qualified variants', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { MECH: 1 } },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })
    const api = new AbilityContext('attacker', state.params).api.own
    const [id] = api.system.getUnits('MECH', { includeVariants: false })
    const stats = api.getUnitStats('MECH')
    expect(api.getUnitStats(id)).toEqual(stats)
    expect(
      api.getUnitStats(makeUnitLocator('MECH', api.getUnitSurface(id)!)),
    ).toEqual(stats)
  })
})
