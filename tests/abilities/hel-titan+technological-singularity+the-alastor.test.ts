import { describe, expect, it } from 'vitest'

import {
  createRuntimeAbilityList,
  extractDefaults,
  withRunningAbility,
} from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { getGameData } from '@/utils/get-game-data'

import { combatTest } from '../utils/combat-test'

const HEL_TITAN = 'NEKRO_UNIT_TITANS_OF_UL_PDS'

type UnitPriorityConfig = {
  groundUnitPriority: [string][]
  spaceUnitPriority: [string][]
}

function priorityKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(entry => (Array.isArray(entry) ? entry[0] : entry))
}

describe('HEL_TITAN + TECHNOLOGICAL_SINGULARITY + THE_ALASTOR', () => {
  it('declares every explicit category on the generated Nekro unit copy', () => {
    const abilities = getGameData('TI4').getAvailableAbilities(
      'attacker',
      'NEKRO_VIRUS',
    )
    const helTitan = abilities.find(ability => ability.key === HEL_TITAN)!
    const list = createRuntimeAbilityList(abilities)

    expect(
      helTitan.declareParamChange?.(extractDefaults(helTitan), {
        abilities: { own: list, opponent: list },
        this: helTitan,
      }),
    ).toEqual([
      { key: 'STRUCTURES', value: 'PDS' },
      { key: 'GROUND_FORCES', value: 'PDS' },
    ])
  })

  it('lists a directly copied Hel-Titan in ground and Alastor space hit order', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NEKRO_VIRUS')
    setup.setCombatMode('GROUND')
    setup.setAbilityParam('attacker', HEL_TITAN, {
      ...setup.abilities.attacker[HEL_TITAN],
      isEnabled: true,
    })
    // Rendering serializes the current setup for URL synchronization before
    // the ability panels read their options.
    setup.toSerializedConfig()
    const enabledPriority = setup.abilities.attacker
      .UNIT_PRIORITY as UnitPriorityConfig

    expect(enabledPriority.groundUnitPriority.map(([unit]) => unit)).toContain(
      'PDS',
    )
    expect(enabledPriority.spaceUnitPriority.map(([unit]) => unit)).toContain(
      'PDS',
    )

    const unitPriorityAbility = setup
      .getAvailableAbilities('attacker')
      .find(ability => ability.key === 'UNIT_PRIORITY')!
    const uiConfig = unitPriorityAbility.uiConfig
    if (typeof uiConfig !== 'function') throw new Error()
    const readContext = setup.getReadContext('attacker')
    const [groundPriorityConfig] = withRunningAbility(
      readContext,
      unitPriorityAbility,
      () => uiConfig(readContext, enabledPriority),
    )!
    expect(groundPriorityConfig.type).toBe('unit-list')
    if (groundPriorityConfig.type !== 'unit-list') throw new Error()
    expect(groundPriorityConfig.items.map(item => item.value)).toContain('PDS')

    setup.setAbilityParam('attacker', HEL_TITAN, {
      ...setup.abilities.attacker[HEL_TITAN],
      isEnabled: false,
    })
    const disabledPriority = setup.abilities.attacker
      .UNIT_PRIORITY as UnitPriorityConfig
    expect(
      disabledPriority.groundUnitPriority.map(([unit]) => unit),
    ).not.toContain('PDS')
    expect(
      disabledPriority.spaceUnitPriority.map(([unit]) => unit),
    ).not.toContain('PDS')
  })

  it('TS-picked Hel Titan II propagates its wrapper declarations to hit and Sustain order', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, PDS: 2, CRUISER: 1 },
        abilities: {
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: HEL_TITAN,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    const sustain = t.state.attacker.abilities.SUSTAIN_DAMAGE as
      | { spacePriority?: [string, boolean][] }
      | undefined
    expect(sustain?.spacePriority?.map(([u]) => u)).toContain('PDS')

    const unitPriority = t.state.attacker.abilities
      .UNIT_PRIORITY as UnitPriorityConfig
    expect(unitPriority.spaceUnitPriority.map(([unit]) => unit)).toContain(
      'PDS',
    )
  })

  it('feeds target categories into the firing side unit-ability priorities', () => {
    const bombardment = new CombatSetup('FULL')
    bombardment.setCombatMode('GROUND')
    bombardment.setFaction('defender', 'TITANS_OF_UL')
    expect(
      priorityKeys(bombardment.abilities.attacker.BOMBARDMENT?.unitPriority),
    ).toContain('PDS')

    const defense = new CombatSetup('FULL')
    defense.setCombatMode('GROUND')
    defense.setFaction('attacker', 'TITANS_OF_UL')
    expect(
      priorityKeys(
        defense.abilities.defender.SPACE_CANNON_DEFENSE?.unitPriority,
      ),
    ).toContain('PDS')
  })

  it('uses opponent ship declarations for SCO while AFB remains fighter-only', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'ARBOREC')
    setup.setFaction('defender', 'NEKRO_VIRUS')
    setup.setCombatMode('SPACE')

    expect(
      priorityKeys(setup.abilities.attacker.SPACE_CANNON_OFFENSE?.unitPriority),
    ).toEqual(expect.arrayContaining(['INFANTRY', 'MECH']))
    expect(
      priorityKeys(setup.abilities.attacker.ANTI_FIGHTER_BARRAGE?.unitPriority),
    ).toEqual(['FIGHTER'])
  })
})
