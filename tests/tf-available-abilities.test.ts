import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { getAvailableAbilities } from '@/hooks/combat-setup/get-available-abilities'

describe("Twilight's Fall available abilities", () => {
  it('hides Galvanized Units — there is no Galvanize mechanic in TF', () => {
    const regs = getAvailableAbilities('attacker', 'AVARICE_REX')
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(false)
    // Sanity: the GENERAL slot itself and the ADVANCED phase drivers stay.
    expect(regs.some(r => r.slot === 'GENERAL')).toBe(true)
    expect(regs.some(r => r.slot === 'ADVANCED')).toBe(true)
    // And the TF shared pool is layered in.
    expect(regs.some(r => r.ability.key === 'TF_HARDLIGHT')).toBe(true)
  })

  it('keeps Galvanized Units for TI4 factions', () => {
    const regs = getAvailableAbilities('attacker', 'ARBOREC')
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(true)
  })

  it('lists TF abilities and genomes alphabetically', () => {
    const regs = getAvailableAbilities('attacker', 'AVARICE_REX')
    const names = (slot: string) =>
      regs.filter(r => r.slot === slot).map(r => r.ability.name)
    const sorted = (arr: string[]) =>
      [...arr].sort((a, b) => a.localeCompare(b))
    expect(names('TF_ABILITY')).toEqual(sorted(names('TF_ABILITY')))
    expect(names('TF_GENOME')).toEqual(sorted(names('TF_GENOME')))
  })

  it("lists TF unit upgrades in the UI's unit order, alphabetical within type", () => {
    const regs = getAvailableAbilities('attacker', 'AVARICE_REX')
    const upgrades = regs.filter(r => r.slot === 'TF_UNIT_UPGRADE')
    // Non-mech cards carry their unit type in the exclusive group; mechs
    // (the stacking cards) have none.
    const typeOf = (r: (typeof upgrades)[number]) =>
      r.ability.exclusiveGroup?.replace('TF_UNIT_UPGRADE_', '') ?? 'MECH'
    const uiOrder = [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CARRIER',
      'CRUISER',
      'DESTROYER',
      'FIGHTER',
      'MECH',
      'INFANTRY',
      'PDS',
    ]
    const ranks = upgrades.map(r => uiOrder.indexOf(typeOf(r)))
    expect(ranks).not.toContain(-1)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    // Alphabetical within each unit type.
    for (const type of uiOrder) {
      const names = upgrades
        .filter(r => typeOf(r) === type)
        .map(r => r.ability.name)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    }
  })

  it('every TF ability, genome, paradigm, and unit upgrade carries its faction logo', () => {
    const regs = getAvailableAbilities('attacker', 'AVARICE_REX')
    for (const slot of [
      'TF_ABILITY',
      'TF_GENOME',
      'TF_PARADIGM',
      'TF_UNIT_UPGRADE',
    ]) {
      const entries = regs.filter(r => r.slot === slot)
      expect(entries.length).toBeGreaterThan(0)
      for (const r of entries) {
        expect(r.ability.icon, `${r.ability.name} is missing an icon`).toEqual(
          expect.stringContaining('<svg'),
        )
      }
    }
  })
})

describe("Twilight's Fall unit-upgrade exclusivity", () => {
  function tfSetup(): {
    setup: CombatSetup
    enable: (key: string) => void
    isEnabled: (key: string) => boolean
  } {
    const setup = new CombatSetup()
    setup.setSystem('TWILIGHTS_FALL')
    return {
      setup,
      enable: key =>
        setup.setAbilityParam('attacker', key, {
          ...setup.abilities.attacker[key],
          isEnabled: true,
        }),
      isEnabled: key => setup.abilities.attacker[key]?.isEnabled === true,
    }
  }

  it('allows one upgrade per unit type at the same time', () => {
    const { enable, isEnabled } = tfSetup()
    enable('TF_UPGRADE_CORSAIR') // cruiser
    enable('TF_UPGRADE_ADVANCED_CARRIER') // carrier
    enable('TF_UPGRADE_EXILE') // destroyer

    expect(isEnabled('TF_UPGRADE_CORSAIR')).toBe(true)
    expect(isEnabled('TF_UPGRADE_ADVANCED_CARRIER')).toBe(true)
    expect(isEnabled('TF_UPGRADE_EXILE')).toBe(true)
  })

  it('enabling a second upgrade of the same unit type disables the first', () => {
    const { enable, isEnabled } = tfSetup()
    enable('TF_UPGRADE_CORSAIR')
    enable('TF_UPGRADE_AHK_SYL_FIER') // also cruiser

    expect(isEnabled('TF_UPGRADE_CORSAIR')).toBe(false)
    expect(isEnabled('TF_UPGRADE_AHK_SYL_FIER')).toBe(true)
  })

  it('carrier cards are mutually exclusive with each other', () => {
    const { enable, isEnabled } = tfSetup()
    enable('TF_UPGRADE_ADVANCED_CARRIER')
    enable('TF_UPGRADE_AMBASSADOR')

    expect(isEnabled('TF_UPGRADE_ADVANCED_CARRIER')).toBe(false)
    expect(isEnabled('TF_UPGRADE_AMBASSADOR')).toBe(true)

    enable('TF_UPGRADE_VORTEXER')
    expect(isEnabled('TF_UPGRADE_AMBASSADOR')).toBe(false)
    expect(isEnabled('TF_UPGRADE_VORTEXER')).toBe(true)
  })

  it('mech upgrades stack with each other and with other types', () => {
    const { enable, isEnabled } = tfSetup()
    enable('TF_UPGRADE_EIDOLON_LANDWASTER')
    enable('TF_UPGRADE_EIDOLON_TERMINUS')
    enable('TF_UPGRADE_CORSAIR')

    expect(isEnabled('TF_UPGRADE_EIDOLON_LANDWASTER')).toBe(true)
    expect(isEnabled('TF_UPGRADE_EIDOLON_TERMINUS')).toBe(true)
    expect(isEnabled('TF_UPGRADE_CORSAIR')).toBe(true)
  })
})
