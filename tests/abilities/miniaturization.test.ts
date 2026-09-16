import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import {
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
  type SurfaceDefinition,
} from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { getGameData } from '@/utils/get-game-data'

import { combatTest } from '../utils/combat-test'

const SURFACES: SurfaceDefinition[] = [
  { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
  { id: DEFAULT_PLANET_ID, type: 'PLANET', name: 'Planet 1' },
]

describe('MINIATURIZATION', () => {
  it('grants space placement to otherwise normal structures', () => {
    const units = getFactionUnitConfig('TI4', 'RAL_NEL')
    expect(units.PDS.BASE.ALLOWED_SURFACES).toBeUndefined()
    expect(units.SPACE_DOCK.BASE.ALLOWED_SURFACES).toBeUndefined()

    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1, PDS: 1, SPACE_DOCK: 1 },
        },
        abilities: { CAPACITY: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    expect(state.data.attacker.surfaceUnits[SPACE_SURFACE_ID]).toHaveLength(3)
    for (const type of ['PDS', 'SPACE_DOCK'] as const) {
      const stats = state.data.attacker.unitStats[type]
      expect(typeof stats).not.toBe('function')
      expect(
        typeof stats === 'function' ? undefined : stats.ALLOWED_SURFACES,
      ).toEqual(['SPACE', 'PLANET'])
    }
  })

  it('allows both structures in the full editor space area', () => {
    const setup = new CombatSetup('FULL')
    setup.setFaction('attacker', 'RAL_NEL')

    expect(setup.getUnitConfig('attacker').PDS.allowedSurfaces).toContain(
      'SPACE',
    )
    expect(
      setup.getUnitConfig('attacker').SPACE_DOCK.allowedSurfaces,
    ).toContain('SPACE')

    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'PDS', 1)
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'SPACE_DOCK', 1)
    expect(setup.surfaceSelections.attacker[SPACE_SURFACE_ID].PDS.count).toBe(1)
    expect(
      setup.surfaceSelections.attacker[SPACE_SURFACE_ID].SPACE_DOCK.count,
    ).toBe(1)
  })

  it('prevents structures in space from firing their unit abilities', () => {
    const t = combatTest({
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1, PDS: 1, SPACE_DOCK: 1 },
          [DEFAULT_PLANET_ID]: { PDS: 1, SPACE_DOCK: 1 },
        },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool().attacker

    expect(pool.PDS).toHaveLength(1)
    expect(pool.SPACE_DOCK).toHaveLength(1)
    expect(pool).toContainDice('PDS', [6, 1])
    expect(pool).toContainDice('SPACE_DOCK', [5, 2])
  })

  it('lets Linkship use a structure placed directly in the space area', () => {
    const t = combatTest({
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, PDS: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool().defender

    expect(pool.PDS).toBeUndefined()
    expect(pool).toContainDice('LINKSHIP', [6, 1])
  })

  it('does not let Linkship use a structure on a planet', () => {
    const t = combatTest({
      mode: 'SPACE',
      surfaces: SURFACES,
      activeSurfaceId: SPACE_SURFACE_ID,
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1 },
          [DEFAULT_PLANET_ID]: { PDS: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    expect(t.dicePool().defender.LINKSHIP).toBeUndefined()
  })

  it('registers Miniaturization as an inherent faction ability', () => {
    const ability = getGameData('TI4')
      .getAvailableAbilities('attacker', 'RAL_NEL')
      .find(candidate => candidate.key === 'MINIATURIZATION')

    expect(ability).toMatchObject({
      readOnly: true,
      params: { isEnabled: true },
    })
  })
})
