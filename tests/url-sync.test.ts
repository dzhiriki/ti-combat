import { describe, expect, it } from 'vitest'

import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import { validateSerializedConfig } from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'

function baseConfig(): SerializedConfig {
  return {
    v: 1,
    g: 'TI4',
    af: 'ARBOREC',
    df: 'ARBOREC',
    m: 'S',
    au: { FIGHTER: [1, 0] },
    du: { FIGHTER: [1, 0] },
    aa: {},
    da: {},
  }
}

describe('URL round-trip', () => {
  it.each([
    ['ARBOREC', 'NEUTRAL', 'TI4'],
    ['AVARICE_REX', 'NEUTRAL', 'TF'],
    ['NEUTRAL', 'AVARICE_REX', 'TF'],
    ['NEUTRAL', 'NEUTRAL', 'TI4'],
  ])('restores legacy %s vs %s links as %s', (af, df, system) => {
    const raw = searchParamsToConfig(`?v=1&af=${af}&df=${df}&m=S`)
    expect(raw).not.toHaveProperty('g')
    const result = validateSerializedConfig(raw)
    expect(result.config.g).toBe(system)
    expect(result.warnings).toEqual([])
  })

  it('does not treat an explicitly empty URL system as a legacy link', () => {
    const raw = searchParamsToConfig('?v=1&g=&af=AVARICE_REX&df=NEUTRAL&m=S')
    const result = validateSerializedConfig(raw)
    expect(result.config.g).toBe('TI4')
    expect(result.warnings).toContain('Invalid game system reset to TI4')
  })

  it('round-trips UnitList<number> tuple arrays', () => {
    const galvanizedUnits = [
      ['SPACE_DOCK', 0],
      ['PDS', 0],
      ['FIGHTER', 1],
      ['DESTROYER', 0],
    ]
    const config = baseConfig()
    config.da['PRE_GALVANIZED'] = { galvanizedUnits }

    const search = configToSearchString(config)
    const decoded = searchParamsToConfig(`?${search}`)

    expect(
      (decoded.da as Record<string, Record<string, unknown>>)['PRE_GALVANIZED']
        ?.galvanizedUnits,
    ).toEqual(galvanizedUnits)
  })

  it('round-trips UnitList<boolean> tuple arrays', () => {
    const spacePriority = [
      ['DREADNOUGHT', true],
      ['CRUISER', false],
      ['DESTROYER', true],
    ]
    const config = baseConfig()
    config.da['SUSTAIN_DAMAGE'] = { spacePriority }

    const search = configToSearchString(config)
    const decoded = searchParamsToConfig(`?${search}`)

    expect(
      (decoded.da as Record<string, Record<string, unknown>>)['SUSTAIN_DAMAGE']
        ?.spacePriority,
    ).toEqual(spacePriority)
  })

  it('does not warn for UnitList (V=never) order arrays', () => {
    // UNIT_PRIORITY and SPACE_CANNON_OFFENSE use `UnitList` whose runtime
    // shape is `[K][]` 1-tuples but round-trips through the URL as a flat
    // `K[]` (no second element to pair with). Both shapes are valid runtime
    // input — validation must not flag the round-tripped shape.
    const config = baseConfig()
    config.da['UNIT_PRIORITY'] = {
      spaceUnitPriority: [['FIGHTER'], ['DESTROYER']],
    }
    config.da['SPACE_CANNON_OFFENSE'] = {
      unitPriority: [['FIGHTER'], ['DESTROYER']],
    }
    const search = configToSearchString(config)
    const decoded = searchParamsToConfig(`?${search}`)
    const result = validateSerializedConfig(decoded)
    expect(result.warnings).toEqual([])
    expect(result.config.da['UNIT_PRIORITY']).toBeDefined()
    expect(result.config.da['SPACE_CANNON_OFFENSE']).toBeDefined()
  })

  it('surfaces a warning for legacy URLs with flat-encoded tuple arrays', () => {
    // Pre-fix encoder produced a flat comma-joined string for UnitList<number>
    // (`Array#join` recursively flattens nested tuples). After the fix, those
    // legacy URLs decode as flat string arrays and should fail schema
    // validation rather than silently corrupting the ability config.
    const search =
      '?v=1&af=ARBOREC&df=ARBOREC&m=S&au.FIGHTER=1.0&du.FIGHTER=1.0' +
      '&da.PRE_GALVANIZED.galvanizedUnits=FIGHTER,1,DESTROYER,0'
    const decoded = searchParamsToConfig(search)
    const result = validateSerializedConfig(decoded)
    expect(result.warnings.some(w => w.includes('Galvanized'))).toBe(true)
    expect(result.config.da['PRE_GALVANIZED']).toBeUndefined()
  })

  it('round-trips UnitList (V=never) order arrays', () => {
    const spaceUnitPriority = [['FIGHTER'], ['DESTROYER'], ['CRUISER']]
    const config = baseConfig()
    config.da['UNIT_PRIORITY'] = { spaceUnitPriority }

    const search = configToSearchString(config)
    const decoded = searchParamsToConfig(`?${search}`)

    // Order-mode lists round-trip as flat string arrays — `unwrapUnitListKeys`
    // accepts both shapes, so the consumer treats them equivalently.
    expect(
      (decoded.da as Record<string, Record<string, unknown>>)['UNIT_PRIORITY']
        ?.spaceUnitPriority,
    ).toEqual(['FIGHTER', 'DESTROYER', 'CRUISER'])
  })
})
