import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import { validateSerializedConfig } from '@/hooks/combat-setup/validation'
import { searchParamsToConfig } from '@/hooks/use-url-sync'

describe('toSerializedConfig', () => {
  it('returns version 2', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(config.v).toBe(2)
  })

  it('serializes default factions', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(typeof config.af).toBe('string')
    expect(typeof config.df).toBe('string')
    expect(config.m).toBe('S')
  })

  it('serializes units with count > 0 only', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'DREADNOUGHT', 3)
    setup.setUpgraded('attacker', 'DREADNOUGHT', true)
    const config = setup.toSerializedConfig()
    expect(config.au).toEqual({ DREADNOUGHT: [3, 1] })
    expect(config.du).toEqual({})
  })

  it('omits abilities at default values', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(typeof config.aa).toBe('object')
    expect(typeof config.da).toBe('object')
  })

  it('includes abilities with changed params', () => {
    const setup = new CombatSetup()
    setup.setAbilityParam('attacker', 'DIRECT_HIT', {
      isEnabled: true,
      uses: 2,
    })
    const config = setup.toSerializedConfig()
    expect(config.aa['DIRECT_HIT']).toBeDefined()
    expect(config.aa['DIRECT_HIT'].uses).toBe(2)
  })

  it('includes default-enabled step abilities when disabled', () => {
    const setup = new CombatSetup()
    setup.setAbilityParam('attacker', 'ANTI_FIGHTER_BARRAGE', {
      isEnabled: false,
    })
    setup.setAbilityParam('attacker', 'SPACE_CANNON_OFFENSE', {
      isEnabled: false,
    })
    setup.setAbilityParam('defender', 'SPACE_CANNON_DEFENSE', {
      isEnabled: false,
    })

    const config = setup.toSerializedConfig()

    expect(config.aa['ANTI_FIGHTER_BARRAGE']).toEqual({ isEnabled: false })
    expect(config.aa['SPACE_CANNON_OFFENSE']).toEqual({ isEnabled: false })
    expect(config.da['SPACE_CANNON_DEFENSE']).toEqual({ isEnabled: false })
  })

  it('uses S/G for combat mode', () => {
    const setup = new CombatSetup()
    expect(setup.toSerializedConfig().m).toBe('S')
    setup.setCombatMode('GROUND')
    expect(setup.toSerializedConfig().m).toBe('G')
  })
})

describe('loadConfig', () => {
  it('roundtrips through serialize/load', () => {
    const original = new CombatSetup()
    original.setFaction('attacker', 'ARGENT_FLIGHT')
    original.setFaction('defender', 'ARBOREC')
    original.setUnitCount('attacker', 'DREADNOUGHT', 3)
    original.setUpgraded('attacker', 'DREADNOUGHT', true)
    original.setUnitCount('defender', 'FIGHTER', 5)
    original.setCombatMode('GROUND')

    const serialized = original.toSerializedConfig()

    const restored = new CombatSetup()
    restored.loadConfig(serialized)

    expect(restored.attackerFaction).toBe('ARGENT_FLIGHT')
    expect(restored.defenderFaction).toBe('ARBOREC')
    expect(restored.combatMode).toBe('GROUND')
    expect(restored.attackerSelections['DREADNOUGHT']).toEqual({
      count: 3,
      upgraded: true,
    })
    expect(restored.defenderSelections['FIGHTER']).toEqual({
      count: 5,
      upgraded: false,
    })
  })

  it('preserves non-default ability params through roundtrip', () => {
    const original = new CombatSetup()
    original.setAbilityParam('attacker', 'DIRECT_HIT', {
      isEnabled: true,
      uses: 3,
    })

    const serialized = original.toSerializedConfig()
    const restored = new CombatSetup()
    restored.loadConfig(serialized)

    expect(restored.abilities.attacker['DIRECT_HIT']?.uses).toBe(3)
  })

  it('preserves disabled step abilities through roundtrip', () => {
    const original = new CombatSetup()
    original.setAbilityParam('attacker', 'ANTI_FIGHTER_BARRAGE', {
      isEnabled: false,
    })
    original.setAbilityParam('attacker', 'SPACE_CANNON_OFFENSE', {
      isEnabled: false,
    })
    original.setAbilityParam('defender', 'SPACE_CANNON_DEFENSE', {
      isEnabled: false,
    })

    const restored = new CombatSetup()
    restored.loadConfig(original.toSerializedConfig())

    expect(restored.abilities.attacker['ANTI_FIGHTER_BARRAGE']?.isEnabled).toBe(
      false,
    )
    expect(restored.abilities.attacker['SPACE_CANNON_OFFENSE']?.isEnabled).toBe(
      false,
    )
    expect(restored.abilities.defender['SPACE_CANNON_DEFENSE']?.isEnabled).toBe(
      false,
    )
  })

  it('preserves URL-loaded UNIT_PRIORITY order through final reconcile', () => {
    // Reproduces the URL-restore path: spaceUnitPriority arrives as a flat
    // `string[]` (order-mode lists round-trip without per-key values), and
    // the reconcile pass that runs after loadConfig must preserve it
    // instead of clobbering it with the auto-synced default order.
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'FIGHTER', 1)
    setup.setUnitCount('attacker', 'DESTROYER', 1)
    setup.setUnitCount('defender', 'FIGHTER', 1)
    setup.setUnitCount('defender', 'DESTROYER', 1)
    const base = setup.toSerializedConfig()
    const config: SerializedConfig = {
      ...base,
      da: {
        ...base.da,
        UNIT_PRIORITY: { spaceUnitPriority: ['DESTROYER', 'FIGHTER'] },
      },
    }
    setup.loadConfig(config)
    const priority = setup.abilities.defender['UNIT_PRIORITY']
      ?.spaceUnitPriority as ([string] | string)[]
    const keys = priority.map(e => (typeof e === 'string' ? e : e[0]))
    // DESTROYER must come before FIGHTER — the URL-loaded order wins.
    expect(keys.indexOf('DESTROYER')).toBeLessThan(keys.indexOf('FIGHTER'))
  })

  it('resets to default for absent abilities', () => {
    const setup = new CombatSetup()
    const config: SerializedConfig = {
      v: 1,
      g: 'TI4',
      af: setup.attackerFaction,
      df: setup.defenderFaction,
      m: 'S',
      au: {},
      du: {},
      aa: {},
      da: {},
    }
    setup.loadConfig(config)

    // General abilities should still be initialized
    expect(setup.abilities.attacker['UNIT_PRIORITY']).toBeDefined()
  })

  it('migrates legacy Starlancer ground counts into planet placement', () => {
    const raw = searchParamsToConfig(
      '?v=1&g=TF&af=IL_NA_VIROSET&df=AVARICE_REX&m=S' +
        '&au.MECH=2.0&du.CRUISER=1.0' +
        '&aa.TF_STARLANCER_XI.mechsOnGround=1',
    )
    const setup = new CombatSetup()
    setup.loadConfig(validateSerializedConfig(raw).config)
    setup.setEditorMode('FULL')

    expect(setup.surfaceSelections.attacker.space.MECH.count).toBe(1)
    expect(setup.surfaceSelections.attacker['planet-1'].MECH.count).toBe(1)
  })
})
