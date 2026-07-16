import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import {
  buildAbilityLookup,
  validateSerializedConfig,
} from '@/hooks/combat-setup/validation'

const abilityLookup = buildAbilityLookup(getAllAbilities())

function makeValidConfig(): SerializedConfig {
  const setup = new CombatSetup()
  setup.setUnitCount('attacker', 'DREADNOUGHT', 2)
  return setup.toSerializedConfig()
}

describe('validateSerializedConfig', () => {
  it('accepts a valid config with no warnings', () => {
    const config = makeValidConfig()
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings).toEqual([])
    expect(result.config).toEqual(config)
  })

  it('resets unknown faction to default', () => {
    const config = { ...makeValidConfig(), af: 'NONEXISTENT_FACTION' }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('NONEXISTENT_FACTION')
    expect(result.config.af).not.toBe('NONEXISTENT_FACTION')
  })

  it('resets invalid combat mode to default', () => {
    const config = { ...makeValidConfig(), m: 'X' as 'S' | 'G' }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.m).toBe('S')
  })

  it('ignores unknown unit types with warning', () => {
    const config = makeValidConfig()
    config.au['FAKE_UNIT'] = [3, 0]
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.au['FAKE_UNIT']).toBeUndefined()
  })

  it('clamps unit count to limits', () => {
    const config = makeValidConfig()
    config.au['FLAGSHIP'] = [5, 0]
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.config.au['FLAGSHIP']![0]).toBe(1)
  })

  it('skips ability with invalid base params', () => {
    const config = makeValidConfig()
    config.aa['DIRECT_HIT'] = {
      isEnabled: 'not_a_bool' as unknown as boolean,
      uses: 2,
    }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.aa['DIRECT_HIT']).toBeUndefined()
  })

  it('recognizes faction-owned abilities (technology, breakthrough, ...)', () => {
    // NON_EUCLIDEAN_SHIELDING lives under Barony's `abilities.technology` and
    // GRAVLEASH_MANEUVERS under `abilities.breakthrough` — neither comes from
    // the global ability directories. They must still be recognized so URL
    // restore doesn't drop them with an "Unknown ability" warning.
    const config: SerializedConfig = {
      v: 1,
      af: 'BARONY_OF_LETNEV',
      df: 'ARBOREC',
      m: 'S',
      au: { FIGHTER: [1, 0] },
      du: { FIGHTER: [1, 0] },
      aa: {
        NON_EUCLIDEAN_SHIELDING: { isEnabled: true },
        GRAVLEASH_MANEUVERS: { isEnabled: true },
      },
      da: {},
    }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings).toEqual([])
    expect(result.config.aa['NON_EUCLIDEAN_SHIELDING']).toBeDefined()
    expect(result.config.aa['GRAVLEASH_MANEUVERS']).toBeDefined()
  })

  it('skips unknown ability keys with warning', () => {
    const config = makeValidConfig()
    config.aa['NONEXISTENT_ABILITY'] = { isEnabled: true, uses: 1 }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.aa['NONEXISTENT_ABILITY']).toBeUndefined()
  })

  it('keeps valid abilities alongside invalid ones', () => {
    const config = makeValidConfig()
    config.aa['DIRECT_HIT'] = { isEnabled: true, uses: 2 }
    config.aa['FAKE_ABILITY'] = { isEnabled: true, uses: 1 }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.config.aa['DIRECT_HIT']).toBeDefined()
    expect(result.config.aa['FAKE_ABILITY']).toBeUndefined()
  })

  // Twilight's Fall shared-deck abilities live only in TF_SHARED_REGISTERED —
  // if the lookup misses them, every saved TF card is stripped on page
  // refresh ("Unknown ability skipped").
  it("keeps Twilight's Fall shared-deck abilities across a save/load round-trip", () => {
    const setup = new CombatSetup()
    setup.setSystem('TWILIGHTS_FALL')
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('defender', 'CRUISER', 1)
    setup.setAbilityParam('attacker', 'TF_HARDLIGHT', {
      isEnabled: true,
      uses: 2,
    })
    setup.setAbilityParam('attacker', 'TF_DIVINITY', {
      isEnabled: true,
      uses: 1,
    })
    setup.setAbilityParam('defender', 'TF_MEDDLE', {
      isEnabled: true,
      uses: 1,
      target: 'anyPreferOwn',
    })

    const config = setup.toSerializedConfig()
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings).toEqual([])
    expect(result.config.aa['TF_HARDLIGHT']).toBeDefined()
    expect(result.config.aa['TF_DIVINITY']).toBeDefined()
    expect(result.config.da['TF_MEDDLE']).toBeDefined()

    const restored = new CombatSetup()
    restored.loadConfig(result.config)
    expect(restored.abilities.attacker['TF_HARDLIGHT']?.uses).toBe(2)
    expect(restored.abilities.attacker['TF_DIVINITY']?.isEnabled).toBe(true)
    expect(restored.abilities.defender['TF_MEDDLE']?.isEnabled).toBe(true)
  })

  it('warns when custom param shape fails schema validation', () => {
    const config = makeValidConfig()
    // PRE_GALVANIZED expects [string, number][] but a flat string array
    // (the shape produced by the pre-fix decoder) should now be rejected.
    config.da['PRE_GALVANIZED'] = {
      isEnabled: true,
      galvanizedUnits: ['FIGHTER', '1', 'DESTROYER', '0'],
    }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.some(w => w.includes('Galvanized'))).toBe(true)
    expect(result.config.da['PRE_GALVANIZED']).toBeUndefined()
  })
})
