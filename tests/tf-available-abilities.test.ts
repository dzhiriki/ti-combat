import { describe, expect, it } from 'vitest'

import { extractDefaults, withRunningAbility } from '@/combat'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import { CombatSetup } from '@/hooks/combat-setup'
import type { UnitBaseType } from '@/types'
import { getGameData } from '@/utils/get-game-data'

import { combatTest } from './utils/combat-test'

describe("Twilight's Fall available abilities", () => {
  it('hides Galvanized Units — there is no Galvanize mechanic in TF', () => {
    const regs = getGameData('TF').getAvailableAbilities(
      'attacker',
      'AVARICE_REX',
    )
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(false)
    // Sanity: the GENERAL slot itself and the ADVANCED phase drivers stay.
    expect(regs.some(r => r.slot === 'GENERAL')).toBe(true)
    expect(regs.some(r => r.slot === 'ADVANCED')).toBe(true)
    // And the TF shared pool is layered in.
    expect(regs.some(r => r.ability.key === 'TF_HARDLIGHT')).toBe(true)
  })

  it('keeps Galvanized Units for TI4 factions', () => {
    const regs = getGameData('TI4').getAvailableAbilities('attacker', 'ARBOREC')
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(true)
  })

  it('Temporal Command Suite offers every genome, Clever Genome included', () => {
    const setup = new CombatSetup()
    setup.setSystem('TF')
    setup.setFaction('attacker', 'AVARICE_REX')
    const tcs = setup
      .getAvailableAbilities('attacker')
      .find(r => r.ability.key === 'TF_TEMPORAL_COMMAND_SUITE')!.ability
    const ctx = setup.getReadContext('attacker')
    type UiFn = (
      c: typeof ctx,
      p: Record<string, unknown>,
    ) => { items: { value: string }[] }[]
    const [genomeList] = withRunningAbility(ctx, tcs, () =>
      (tcs.uiConfig as unknown as UiFn)(ctx, extractDefaults(tcs)),
    )
    const values = genomeList.items.map(i => i.value)
    // Clever Genome is a separate ability instance — re-readying it fires
    // the copied text a second time in the same window, so it gets a row.
    expect(values).toContain('TF_CLEVER_GENOME')
    expect(values).toContain('TF_ALTRUISTIC_GENOME')
    expect(values.length).toBeGreaterThan(5)
  })

  it('lists TF abilities and genomes alphabetically', () => {
    const regs = getGameData('TF').getAvailableAbilities(
      'attacker',
      'AVARICE_REX',
    )
    const names = (slot: string) =>
      regs.filter(r => r.slot === slot).map(r => r.ability.name)
    const sorted = (arr: string[]) =>
      [...arr].sort((a, b) => a.localeCompare(b))
    expect(names('TF_ABILITY')).toEqual(sorted(names('TF_ABILITY')))
    expect(names('TF_GENOME')).toEqual(sorted(names('TF_GENOME')))
  })

  it("lists TF unit upgrades in the UI's unit order, alphabetical within type", () => {
    const regs = getGameData('TF').getAvailableAbilities(
      'attacker',
      'AVARICE_REX',
    )
    const upgrades = regs.filter(r => r.slot.startsWith('TF_UNIT_UPGRADE_'))
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

  it('tags every TF unit upgrade with its unit type as the panel sub-header', () => {
    const regs = getGameData('TF').getAvailableAbilities(
      'attacker',
      'AVARICE_REX',
    )
    const upgrades = regs.filter(r => r.slot.startsWith('TF_UNIT_UPGRADE_'))
    const typeOf = (r: (typeof upgrades)[number]) =>
      r.ability.exclusiveGroup?.replace('TF_UNIT_UPGRADE_', '') ?? 'MECH'
    for (const r of upgrades) {
      expect(
        r.display.subcategory,
        `${r.ability.name} is missing a sub-header`,
      ).toBe(UNIT_DISPLAY_NAMES[typeOf(r) as UnitBaseType])
    }
    // Every unit type in the deck gets its own group, no stray extras.
    const groups = [...new Set(upgrades.map(r => r.display.subcategory))]
    expect(groups).toEqual([
      'Flagship',
      'War Sun',
      'Dreadnought',
      'Carrier',
      'Cruiser',
      'Destroyer',
      'Fighter',
      'Mech',
      'Infantry',
      'PDS',
    ])
  })

  it('neutral in a TF session matches the TF slot layout', () => {
    const regs = getGameData('TF').getAvailableAbilities('attacker', 'NEUTRAL')
    // No OTHER catch-all, no Galvanize, no TI4 agent pool.
    expect(regs.some(r => r.slot === 'OTHER')).toBe(false)
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(false)
    expect(regs.some(r => r.slot === 'FACTION_AGENT')).toBe(false)
    // Agents are replaced by the TF genome deck — and only the genome deck.
    expect(regs.some(r => r.slot === 'TF_GENOME')).toBe(true)
    expect(regs.some(r => r.slot === 'TF_ABILITY')).toBe(false)
    expect(regs.some(r => r.slot.startsWith('TF_UNIT_UPGRADE_'))).toBe(false)
    // GENERAL and the ADVANCED phase drivers stay.
    expect(regs.some(r => r.slot === 'GENERAL')).toBe(true)
    expect(regs.some(r => r.slot === 'ADVANCED')).toBe(true)
  })

  it('neutral in a TI4 session keeps the agent pool, OTHER, and Galvanize', () => {
    const regs = getGameData('TI4').getAvailableAbilities('attacker', 'NEUTRAL')
    expect(regs.some(r => r.slot === 'FACTION_AGENT')).toBe(true)
    expect(regs.some(r => r.slot === 'OTHER')).toBe(true)
    expect(regs.some(r => r.ability.key === 'PRE_GALVANIZED')).toBe(true)
    expect(regs.some(r => r.slot === 'TF_GENOME')).toBe(false)
  })

  it('Artemiris Ascendant defaults to placing the flagship and 2 cruisers', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_ARTEMIRIS_ASCENDANT: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Placed at the start of round 1 with no further configuration.
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })

  it('neutral vs a TF faction can use a TF genome in combat', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'NEUTRAL',
        units: { CRUISER: 2 },
        abilities: { TF_MIRROR_GENOME: true },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Mirror Genome blocks the TF opponent's Space Cannon Offense.
    expect(t.dicePool()?.defender?.PDS).toBeUndefined()
  })

  it('Il Na Viroset mechs appear in the space assign-hits and sustain lists', () => {
    const setup = new CombatSetup()
    setup.setSystem('TF')
    setup.setFaction('attacker', 'IL_NA_VIROSET')

    const config = setup.abilities.attacker
    const priorityKeys = (
      config.UNIT_PRIORITY.spaceUnitPriority as [string][]
    ).map(e => (Array.isArray(e) ? e[0] : e))
    expect(priorityKeys).toContain('MECH')

    const sustainKeys = (
      config.SUSTAIN_DAMAGE.spacePriority as [string, boolean][]
    ).map(([k]) => k)
    expect(sustainKeys).toContain('MECH')

    // Sanity: a plain TF faction gets neither
    setup.setFaction('attacker', 'AVARICE_REX')
    const plain = setup.abilities.attacker
    const plainPriority = (
      plain.UNIT_PRIORITY.spaceUnitPriority as [string][]
    ).map(e => (Array.isArray(e) ? e[0] : e))
    expect(plainPriority).not.toContain('MECH')
  })

  it('every TF faction carries its own logo', () => {
    for (const [key, faction] of Object.entries(getGameData('TF').factions)) {
      if (key === 'NEUTRAL') continue
      expect(faction.icon, `${key} is missing an icon`).toEqual(
        expect.stringContaining('<svg'),
      )
    }
  })

  it('every TF ability, genome, paradigm, and unit upgrade carries its faction logo', () => {
    const regs = getGameData('TF').getAvailableAbilities(
      'attacker',
      'AVARICE_REX',
    )
    for (const slot of [
      'TF_ABILITY',
      'TF_GENOME',
      'TF_PARADIGM',
      'TF_UNIT_UPGRADE_',
    ]) {
      const entries = regs.filter(r => r.slot.startsWith(slot))
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
    setup.setSystem('TF')
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
