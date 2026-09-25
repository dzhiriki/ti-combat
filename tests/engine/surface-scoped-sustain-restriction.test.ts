import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { makeUnitLocator } from '@/combat'
import type { SurfaceDefinition, SurfaceId, UnitType } from '@/types'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: Sustain Damage's guard does not check lost/cannotBeUsed
 * itself. `AbilitiesEngine.tryResolveOne` rejects unit-sourced invokes of
 * UNIT_ABILITIES keys after `isCallable`, resolving the source unit's
 * surface. These cases pin that check for surface-scoped restrictions.
 */

const SPACE = SPACE_SURFACE_ID
const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId
const SURFACES: SurfaceDefinition[] = [
  { id: SPACE, type: 'SPACE', name: 'Space' },
  { id: P1, type: 'PLANET', name: 'Planet 1' },
  { id: P2, type: 'PLANET', name: 'Planet 2' },
]
const LAYERS = ['lost', 'cannotBeUsed'] as const

function restrictMechSustain(
  layer: (typeof LAYERS)[number],
  surfaceId: SurfaceId,
): Ability {
  return {
    key: 'TEST_RESTRICT_MECH_SUSTAIN',
    name: 'Test Restrict Mech Sustain',
    params: { isEnabled: false, uses: Infinity },
    invoke: [
      {
        timing: 'PREPARE',
        call: ctx => {
          if (layer === 'lost')
            ctx.api.own.setUnitAbilityLost(
              'SUSTAIN_DAMAGE',
              ctx.this.key,
              'MECH',
              surfaceId,
            )
          else
            ctx.api.own.setUnitAbilityCannotBeUsed(
              'SUSTAIN_DAMAGE',
              ctx.this.key,
              'MECH',
              surfaceId,
            )
        },
      },
    ],
  }
}

function spaceCombat(restricted: SurfaceId, layer: (typeof LAYERS)[number]) {
  const mech = (surface: SurfaceId) =>
    makeUnitLocator('MECH' as UnitType, surface)
  return combatTest({
    mode: 'SPACE',
    surfaces: SURFACES,
    attacker: {
      faction: 'NEKRO_VIRUS',
      units: {},
      placements: {
        [SPACE]: { FLAGSHIP: 1 },
        [P1]: { MECH: 1 },
        [P2]: { MECH: 1 },
      },
      abilities: {
        TEST_RESTRICT_MECH_SUSTAIN: true,
        SUSTAIN_DAMAGE: {
          spacePriority: [
            [mech(P2), true],
            [mech(P1), true],
          ],
        },
      },
    },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    customAbilities: [restrictMechSustain(layer, restricted)],
  })
}

function groundCombat(restricted: SurfaceId, layer: (typeof LAYERS)[number]) {
  return combatTest({
    mode: 'GROUND',
    surfaces: SURFACES,
    activeSurfaceId: P1,
    attacker: {
      faction: 'BARONY_OF_LETNEV',
      units: {},
      placements: { [P1]: { MECH: 1 }, [P2]: { MECH: 1 } },
      abilities: { TEST_RESTRICT_MECH_SUSTAIN: true },
    },
    defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    customAbilities: [restrictMechSustain(layer, restricted)],
  })
}

const isDamaged = (t: ReturnType<typeof combatTest>, surface: SurfaceId) => {
  const id = t.state.attacker.surfaceUnits[surface][0]
  return id === undefined ? undefined : !!t.state.attacker.unitState[id]
}

describe('engine: surface-scoped sustain restriction', () => {
  it.each(LAYERS)(
    'space: a %s restriction on one planet moves sustain to the other',
    layer => {
      const t = spaceCombat(P2, layer)
      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ attacker: 1 })
      expect(t.state.attacker.surfaceUnits[P2]).toHaveLength(1)
      expect(isDamaged(t, P2)).toBe(false)
      expect(isDamaged(t, P1)).toBe(true)
    },
  )

  it.each(LAYERS)(
    'space: a %s restriction elsewhere keeps the preferred mech',
    layer => {
      const t = spaceCombat(P1, layer)
      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ attacker: 1 })
      expect(isDamaged(t, P2)).toBe(true)
      expect(isDamaged(t, P1)).toBe(false)
    },
  )

  it.each(LAYERS)(
    'ground: a %s restriction on the combat planet blocks sustain',
    layer => {
      const t = groundCombat(P1, layer)
      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ attacker: 1 })
      expect(t.state.attacker.surfaceUnits[P1]).toHaveLength(0)
    },
  )

  it.each(LAYERS)(
    'ground: a %s restriction on another planet leaves sustain',
    layer => {
      const t = groundCombat(P2, layer)
      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ attacker: 1 })
      expect(t.state.attacker.surfaceUnits[P1]).toHaveLength(1)
      expect(isDamaged(t, P1)).toBe(true)
    },
  )
})
