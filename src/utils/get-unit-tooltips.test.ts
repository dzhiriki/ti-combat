import { describe, expect, it } from 'vitest'

import { UNIT_TYPES } from '@/constants/units'
import { CombatSetup } from '@/hooks/combat-setup'
import type { CombatSide, UnitBaseType, UnitSelection } from '@/types'

import { getGameData } from './get-game-data'
import { getUnitTooltips } from './get-unit-tooltips'
import { isStatsInvoke } from './is-stats-invoke'
import { isStatsTransformInvoke } from './is-stats-transform-invoke'

function input(
  overrides: Partial<Parameters<typeof getUnitTooltips>[0]> = {},
): Parameters<typeof getUnitTooltips>[0] {
  return {
    system: 'TI4',
    faction: 'ARBOREC',
    side: 'attacker',
    selections: Object.fromEntries(
      UNIT_TYPES.map(type => [type, { count: 0, upgraded: false }]),
    ) as Record<UnitBaseType, UnitSelection>,
    abilities: {},
    ...overrides,
  }
}

function fromSetup(setup: CombatSetup, side: CombatSide = 'attacker') {
  return getUnitTooltips({
    system: setup.system,
    faction:
      side === 'attacker' ? setup.attackerFaction : setup.defenderFaction,
    selections:
      side === 'attacker' ? setup.attackerSelections : setup.defenderSelections,
    abilities: setup.abilities[side],
    side,
  })
}

describe('unit reference cards', () => {
  it('resolves every unit at zero count and merges generic upgrades', () => {
    const config = input()
    const base = getUnitTooltips(config)
    expect(Object.keys(base)).toEqual(UNIT_TYPES)
    expect(base.CARRIER).toMatchObject({
      name: 'Carrier I',
      stats: { CAPACITY: 4, MOVE: 1 },
    })
    config.selections.CARRIER.upgraded = true
    expect(getUnitTooltips(config).CARRIER).toMatchObject({
      name: 'Carrier II',
      stats: { COST: 3, CAPACITY: 6, MOVE: 2 },
    })
    expect(base.CARRIER.stats.CAPACITY).toBe(4)
  })

  it('uses faction upgrades and preserves inherited unit abilities', () => {
    const config = input({ faction: 'FEDERATION_OF_SOL' })
    config.selections.CARRIER.upgraded = true
    config.selections.INFANTRY.upgraded = true
    const data = getUnitTooltips(config)
    expect(data.CARRIER).toMatchObject({
      name: 'Advanced Carrier II',
      stats: { CAPACITY: 8, UNIT_ABILITIES: { SUSTAIN_DAMAGE: true } },
    })
    expect(data.INFANTRY).toMatchObject({
      name: 'Spec Ops II',
      stats: { COMBAT: [6, 1] },
    })
    expect(data.INFANTRY.textAbilities[0].description).toContain('5 or greater')
    expect(data.FLAGSHIP.name).toBe('Genesis')
  })

  it('uses and removes Nekro copies independently of native upgrade toggles', () => {
    const config = input({
      faction: 'NEKRO_VIRUS',
      abilities: { NEKRO_UNIT_FEDERATION_OF_SOL_CARRIER: { isEnabled: true } },
    })
    expect(getUnitTooltips(config).CARRIER).toMatchObject({
      name: 'Advanced Carrier II',
      stats: { CAPACITY: 8, UNIT_ABILITIES: { SUSTAIN_DAMAGE: true } },
    })
    config.selections.CARRIER.upgraded = true
    expect(getUnitTooltips(config).CARRIER.name).toBe('Advanced Carrier II')
    config.abilities.NEKRO_UNIT_FEDERATION_OF_SOL_CARRIER.isEnabled = false
    expect(getUnitTooltips(config).CARRIER).toMatchObject({
      name: 'Carrier II',
      stats: { CAPACITY: 6 },
    })
  })

  it('shows all enabled Alastor copies, including ground-only text, without duplicate native text', () => {
    const config = input({
      faction: 'NEKRO_VIRUS',
      abilities: {
        NEKRO_FLAGSHIP_FOURTH_MOON: { isEnabled: true },
        NEKRO_FLAGSHIP_MATRIARCH: { isEnabled: true },
        NEKRO_FLAGSHIP_VAN_HAUGE: { isEnabled: false },
      },
    })
    const flagship = getUnitTooltips(config).FLAGSHIP
    expect(flagship.name).toBe('The Alastor')
    expect(
      flagship.textAbilities.filter(a =>
        a.description?.includes('choose any number'),
      ),
    ).toHaveLength(1)
    expect(flagship.copiedAbilities.map(a => a.name)).toEqual(
      expect.arrayContaining(['Fourth Moon', 'Matriarch']),
    )
    expect(flagship.copiedAbilities.map(a => a.name)).not.toContain('Van Hauge')
    expect(flagship.copiedAbilities.every(a => a.description)).toBe(true)
  })

  it('respects numeric enable controls and merges Alastor copy defaults', () => {
    const alastor =
      getGameData('TI4').getFactionUnitConfig('NEKRO_VIRUS').FLAGSHIP.BASE
    const copies = (alastor.ABILITIES ?? []).filter(
      a => a.key.startsWith('NEKRO_FLAGSHIP_') && a.headerUI === 'uses',
    )
    expect(copies.length).toBeGreaterThan(0)
    for (const copy of copies) {
      const config = input({
        faction: 'NEKRO_VIRUS',
        abilities: { [copy.key]: { uses: 1 } },
      })
      expect(
        getUnitTooltips(config).FLAGSHIP.copiedAbilities.map(a => a.name),
      ).toContain(copy.name)
      config.abilities[copy.key].uses = 0
      expect(
        getUnitTooltips(config).FLAGSHIP.copiedAbilities.map(a => a.name),
      ).not.toContain(copy.name)
    }
  })

  it('does not apply combat modifiers or future Singularity acquisitions', () => {
    const config = input({
      faction: 'NEKRO_VIRUS',
      abilities: {
        MORALE_BOOST: { isEnabled: true },
        TECHNOLOGICAL_SINGULARITY: {
          isEnabled: true,
          enableAbilityKey: 'NEKRO_UNIT_FEDERATION_OF_SOL_CARRIER',
        },
      },
    })
    expect(getUnitTooltips(config).CARRIER).toMatchObject({
      name: 'Carrier I',
      stats: { COMBAT: [9, 1], CAPACITY: 4 },
    })
  })

  it.each([
    ['TF_UPGRADE_HEL_TITAN', 'PDS', 'Hel-Titan', [5, 1]],
    ['TF_UPGRADE_PROTOTYPE_WAR_SUN', 'WAR_SUN', 'Prototype War Sun', [3, 3]],
    ['TF_UPGRADE_UNIVERSITY_WAR_SUN', 'WAR_SUN', 'University War Sun', [4, 3]],
    ['TF_UPGRADE_THE_DRAGON_FREED', 'WAR_SUN', 'The Dragon, Freed', [3, 3]],
    ['TF_UPGRADE_EXOTRIREME', 'DREADNOUGHT', 'Exotrireme', [4, 1]],
  ] as const)(
    'resolves %s printed stats even at zero uses',
    (key, type, name, combat) => {
      const config = input({
        system: 'TF',
        faction: 'AVARICE_REX',
        abilities: { [key]: { isEnabled: true, uses: 0 } },
      })
      const card = getUnitTooltips(config)[type]
      expect(card.name).toBe(name)
      expect(card.stats.COMBAT).toEqual(combat)
      expect(card.textAbilities.length).toBeGreaterThan(0)
    },
  )

  it('exposes reference metadata for every TF upgrade card', () => {
    const upgrades = getGameData('TF').allAbilities.filter(a =>
      a.slot.startsWith('UNIT_UPGRADE_'),
    )
    expect(upgrades.length).toBeGreaterThan(20)
    for (const card of upgrades) {
      expect(
        Array.isArray(card.invoke) &&
          card.invoke.some(
            inv => isStatsInvoke(inv) || isStatsTransformInvoke(inv),
          ),
        card.key,
      ).toBe(true)
    }
  })

  it('applies relative flagship and stacked mech upgrades without replacing faction identity or mutating definitions', () => {
    const config = input({
      system: 'TF',
      faction: 'AVARICE_REX',
      abilities: {
        TF_UPGRADE_ECHO_OF_ASCENSION: { isEnabled: true },
        TF_UPGRADE_EIDOLON_TERMINUS: { isEnabled: true },
        TF_UPGRADE_EIDOLON_LANDWASTER: { isEnabled: true },
      },
    })
    const data = getUnitTooltips(config)
    expect(data.FLAGSHIP).toMatchObject({
      name: 'Scintillia',
      stats: { COMBAT: [8, 3], MOVE: 2, CAPACITY: 5 },
    })
    expect(data.MECH).toMatchObject({
      name: 'Delver',
      stats: { COMBAT: [5, 2] },
    })
    expect(data.MECH.textAbilities).toHaveLength(3)
    expect(getUnitTooltips(config).MECH.stats.COMBAT).toEqual([5, 2])
    expect(
      getGameData('TF').getFaction('AVARICE_REX').units.MECH?.BASE.COMBAT,
    ).toEqual([6, 1])
  })

  it('replaces native ability maps for TF fixed upgrades', () => {
    const config = input({
      system: 'TF',
      faction: 'AVARICE_REX',
      abilities: { TF_UPGRADE_CORSAIR: { isEnabled: true } },
    })
    expect(getUnitTooltips(config).CRUISER.name).toBe('Corsair')
    expect(getUnitTooltips(config).CRUISER.stats.UNIT_ABILITIES).toEqual({})
  })

  it('tracks independent sides through edits, swaps, resets, loading and game-system changes', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'NEKRO_VIRUS')
    setup.setFaction('defender', 'FEDERATION_OF_SOL')
    setup.setAbilityParam('attacker', 'NEKRO_UNIT_FEDERATION_OF_SOL_CARRIER', {
      isEnabled: true,
    })
    expect(fromSetup(setup).CARRIER.name).toBe('Advanced Carrier II')
    expect(fromSetup(setup, 'defender').CARRIER.name).toBe('Advanced Carrier I')
    const saved = setup.toSerializedConfig()
    setup.swap()
    expect(fromSetup(setup).CARRIER.name).toBe('Advanced Carrier I')
    expect(fromSetup(setup, 'defender').CARRIER.name).toBe(
      'Advanced Carrier II',
    )
    setup.resetAbilities('defender')
    expect(fromSetup(setup, 'defender').CARRIER.name).toBe('Carrier I')
    setup.loadConfig(saved)
    expect(fromSetup(setup).CARRIER.name).toBe('Advanced Carrier II')
    setup.setSystem('TF')
    expect(fromSetup(setup).CARRIER.name).toBe('Carrier')
    setup.setAbilityParam('attacker', 'TF_UPGRADE_ADVANCED_CARRIER', {
      isEnabled: true,
    })
    expect(fromSetup(setup).CARRIER.name).toBe('Advanced Carrier')
    expect(fromSetup(setup, 'defender').CARRIER.name).toBe('Carrier')
  })
})
