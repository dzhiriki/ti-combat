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
