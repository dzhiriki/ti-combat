import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import { DEFAULT_PLANET_ID, SPACE_SURFACE_ID } from '@/types'
import { getGameData } from '@/utils/get-game-data'

const FLOATING_FACTORY = 'NEKRO_UNIT_CLAN_OF_SAAR_SPACE_DOCK'

describe('TECHNOLOGICAL_SINGULARITY + FLOATING_FACTORY', () => {
  it('offers faction Space Docks as Nekro unit copies', () => {
    const copies = getGameData('TI4').getAvailableAbilities(
      'attacker',
      'NEKRO_VIRUS',
    )
    const copy = copies.find(ability => ability.key === FLOATING_FACTORY)

    expect(copy?.name).toBe('Floating Factory II')
    expect(copy?.slot).toBe('FACTION_SPACE_DOCK')
    expect(
      copies.some(ability => ability.key === 'NEKRO_UNIT_RAL_NEL_SPACE_DOCK'),
    ).toBe(false)
    expect(
      copies.some(ability => ability.key === 'NEKRO_UNIT_RAL_NEL_PDS'),
    ).toBe(false)
  })

  it('allows an enabled Floating Factory copy in space and relocates it when disabled', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'NEKRO_VIRUS')
    expect(
      setup
        .getUnitConfig('attacker')
        .SPACE_DOCK.allowedSurfaces.includes('SPACE'),
    ).toBe(false)
    setup.setAbilityParam('attacker', FLOATING_FACTORY, {
      isEnabled: true,
      uses: Infinity,
    })
    expect(
      setup
        .getUnitConfig('attacker')
        .SPACE_DOCK.allowedSurfaces.includes('SPACE'),
    ).toBe(true)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'SPACE_DOCK', 1)

    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].SPACE_DOCK.count,
    ).toBe(1)

    setup.setAbilityParam('attacker', FLOATING_FACTORY, {
      isEnabled: false,
      uses: Infinity,
    })
    expect(
      setup
        .getUnitConfig('attacker')
        .SPACE_DOCK.allowedSurfaces.includes('SPACE'),
    ).toBe(false)

    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].SPACE_DOCK.count,
    ).toBe(0)
    expect(
      setup.surfaceSelections.attacker[DEFAULT_PLANET_ID].SPACE_DOCK.count,
    ).toBe(1)
  })

  it('uses the copied factory stats and capacity in space', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { SPACE_DOCK: 1, FIGHTER: 5 },
        },
        abilities: {
          [FLOATING_FACTORY]: true,
          CAPACITY: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    const stats = state.data.attacker.unitStats.SPACE_DOCK
    expect(typeof stats).not.toBe('function')
    expect(typeof stats === 'function' ? undefined : stats.NAME).toBe(
      'Floating Factory II',
    )
    expect(state.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(6)
  })

  it('keeps native Floating Factories and their capacity in space', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'CLAN_OF_SAAR',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { SPACE_DOCK: 1, FIGHTER: 4 },
        },
        abilities: { CAPACITY: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    const stats = state.data.attacker.unitStats.SPACE_DOCK
    expect(typeof stats).not.toBe('function')
    expect(typeof stats === 'function' ? undefined : stats.NAME).toBe(
      'Floating Factory I',
    )
    expect(state.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(5)
  })
})
