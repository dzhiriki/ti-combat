import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import {
  buildAbilityLookup,
  validateSerializedConfig,
} from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'

const abilityLookup = buildAbilityLookup(getAllAbilities())

function baseConfig(): SerializedConfig {
  return {
    v: 1,
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
    const decoded = searchParamsToConfig(`?${search}`, abilityLookup)

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
    const decoded = searchParamsToConfig(`?${search}`, abilityLookup)

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
    const decoded = searchParamsToConfig(`?${search}`, abilityLookup)
    const result = validateSerializedConfig(decoded, abilityLookup)
    expect(result.warnings).toEqual([])
    expect(result.config.da['UNIT_PRIORITY']).toBeDefined()
    expect(result.config.da['SPACE_CANNON_OFFENSE']).toBeDefined()
  })

  it('round-trips what reconciliation produces, not just hand-built config', () => {
    // The cases above hand-write well-formed tuple arrays. Reconciliation is
    // what fills in the units a player did not set, and if a declared param
    // has no `defaultItemValue` it fills them in as bare `[type]` 1-tuples —
    // indistinguishable from an order-mode list once encoded, so the counts
    // are dropped on the way back. PRE_GALVANIZED declares one; PRE_DAMAGED
    // did not, and lost its damage on every refresh until it did.
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'SARDAKK_NORR')
    setup.setUnitCount('attacker', 'DREADNOUGHT', 2)
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setAbilityParam('attacker', 'PRE_DAMAGED', {
      ...setup.abilities.attacker['PRE_DAMAGED'],
      damagedUnits: [['DREADNOUGHT', 1]],
    })

    const search = configToSearchString(setup.toSerializedConfig())
    const decoded = searchParamsToConfig(`?${search}`, abilityLookup)
    const result = validateSerializedConfig(decoded, abilityLookup)

    expect(result.warnings).toEqual([])
    const restored = new CombatSetup()
    restored.loadConfig(result.config)
    expect(restored.abilities.attacker['PRE_DAMAGED'].damagedUnits).toEqual([
      ['CRUISER', 0],
      ['DREADNOUGHT', 1],
    ])
  })

  it('surfaces a warning for legacy URLs with flat-encoded tuple arrays', () => {
    // Pre-fix encoder produced a flat comma-joined string for UnitList<number>
    // (`Array#join` recursively flattens nested tuples). After the fix, those
    // legacy URLs decode as flat string arrays and should fail schema
    // validation rather than silently corrupting the ability config.
    const search =
      '?v=1&af=ARBOREC&df=ARBOREC&m=S&au.FIGHTER=1.0&du.FIGHTER=1.0' +
      '&da.PRE_GALVANIZED.galvanizedUnits=FIGHTER,1,DESTROYER,0'
    const decoded = searchParamsToConfig(search, abilityLookup)
    const result = validateSerializedConfig(decoded, abilityLookup)
    expect(result.warnings.some(w => w.includes('Galvanized'))).toBe(true)
    expect(result.config.da['PRE_GALVANIZED']).toBeUndefined()
  })

  it('round-trips UnitList (V=never) order arrays', () => {
    const spaceUnitPriority = [['FIGHTER'], ['DESTROYER'], ['CRUISER']]
    const config = baseConfig()
    config.da['UNIT_PRIORITY'] = { spaceUnitPriority }

    const search = configToSearchString(config)
    const decoded = searchParamsToConfig(`?${search}`, abilityLookup)

    // Order-mode lists round-trip as flat string arrays — `unwrapUnitListKeys`
    // accepts both shapes, so the consumer treats them equivalently.
    expect(
      (decoded.da as Record<string, Record<string, unknown>>)['UNIT_PRIORITY']
        ?.spaceUnitPriority,
    ).toEqual(['FIGHTER', 'DESTROYER', 'CRUISER'])
  })
})
