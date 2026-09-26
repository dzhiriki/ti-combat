import { describe, expect, it } from 'vitest'

import {
  cloneStateForBranch,
  CombatSideState,
  CombatState,
  type Ability,
  type AbilityCallContext,
} from '@/combat'
import { AbilityContext } from '@/combat/abilities-engine/api/ability-api'
import { canonicalizeUnitState } from '@/combat/utils/canonicalize-unit-state'
import { isUnitCategory } from '@/combat/utils/unit-combat-properties'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import {
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
  type UnitId,
  type UnitVariantId,
} from '@/types'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

function apiFor(cs: CombatState) {
  const ctx = new AbilityContext('attacker', cs.params)
  ctx.upgradeForCall({
    key: 'TEST_API',
    name: 'Test API',
    params: { isEnabled: true, uses: Infinity },
    invoke: [],
  })
  return ctx.api.own
}

function makeSpace() {
  const cs = buildCombatState({
    system: 'TI4',
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 1, MECH: 2, INFANTRY: 1 },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
  })
  return { cs, api: apiFor(cs) }
}

describe('individual combat participation and categories', () => {
  it('exposes Alastor mechs in setup priorities before they participate', () => {
    const cs = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'NEKRO_VIRUS', units: { FLAGSHIP: 1, MECH: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })
    const api = apiFor(cs)
    const [mech] = api.system.getUnits('MECH', { includeVariants: true })
    expect(api.isParticipating(mech)).toBe(false)
    expect(
      api.getAbilityConfig('SUSTAIN_DAMAGE').spacePriority.map(([key]) => key),
    ).toContain('MECH')
    expect(
      api
        .getAbilityConfig('UNIT_PRIORITY')
        .spaceUnitPriority.map(([key]) => key),
    ).toContain('MECH')
  })

  it('grants a category together with participation in its combat mode', () => {
    const { cs, api } = makeSpace()
    const [mech, other] = api.system.getUnits('MECH', { includeVariants: true })
    expect(api.isParticipating(mech)).toBe(false)
    api.grantCategory(mech, 'SHIPS')
    expect(api.isUnitCategory(mech, 'SHIPS')).toBe(true)
    expect(api.isParticipating(mech)).toBe(true)
    expect(
      api.participating.getUnits('MECH', { includeVariants: true }),
    ).toEqual([mech])

    // A category outside the combat mode grants membership only.
    api.grantCategory(other, 'STRUCTURES')
    expect(api.isUnitCategory(other, 'STRUCTURES')).toBe(true)
    expect(api.isParticipating(other)).toBe(false)

    const grants = cs.data.attacker.unitGrants
    api.grantCategory(mech, 'SHIPS')
    expect(cs.data.attacker.unitGrants).toBe(grants)
  })

  it('preserves an exact selection through placement, movement, and variant changes', () => {
    const { cs, api } = makeSpace()
    const [chosen, other] = api.system.getUnits('MECH', {
      includeVariants: true,
    })
    api.moveUnits(chosen, DEFAULT_PLANET_ID)
    api.grantCategory(chosen, 'SHIPS')
    const [newMech] = api.placeUnits({ MECH: 1 }).MECH
    const [fighter] = api.placeUnits({ FIGHTER: 1 }).FIGHTER
    api.addSubtype(chosen, 'Test' as UnitVariantId)
    cs.resyncParticipating('attacker')
    expect(
      api.participating.getUnits('MECH', { includeVariants: true }),
    ).toEqual([chosen])
    expect(api.isParticipating(other)).toBe(false)
    expect(api.isParticipating(newMech)).toBe(false)
    expect(api.isParticipating(fighter)).toBe(true)
    expect(api.getUnitSurface(chosen)).toBe(DEFAULT_PLANET_ID)
    expect(
      api.participating.countUnits(undefined, {
        includeVariants: true,
      }),
    ).toBe(3)
    expect(api.participating.getUnitTypes()).toContain('MECH')
    api.removeSubtype(chosen, 'Test' as UnitVariantId)
    expect(api.isParticipating(chosen)).toBe(true)
  })

  it('isolates native categories and instance grants between probability branches', () => {
    const { cs, api } = makeSpace()
    const [mech] = api.system.getUnits('MECH', { includeVariants: true })
    const originalHash = cs.getHash()
    const fork = CombatState.fromDataStandalone(cloneStateForBranch(cs.data))
    const branch = apiFor(fork)
    branch.modifyUnitType('PDS', {
      CATEGORIES: ['STRUCTURES', 'GROUND_FORCES'],
    })
    expect(fork.getHash()).not.toBe(originalHash)
    expect(cs.getHash()).toBe(originalHash)
    branch.grantCategory(mech, 'SHIPS')
    expect(fork.getHash()).not.toBe(originalHash)
    expect(api.isUnitCategory(mech, 'SHIPS')).toBe(false)
    expect(api.isParticipating(mech)).toBe(false)
    branch.modifyUnitType('MECH', { CATEGORIES: ['SHIPS', 'GROUND_FORCES'] })
    expect(api.isUnitTypeCategory('MECH', 'SHIPS')).toBe(false)
    expect(branch.isUnitTypeCategory('MECH', 'SHIPS')).toBe(true)
    expect(cs.getHash()).toBe(originalHash)
  })

  it('does not move damage from a granted mech onto an ungranted one', () => {
    const { cs, api } = makeSpace()
    const [other, chosen] = api.system
      .getUnits('MECH', { includeVariants: true })
      .sort()
    // Both stay non-participating, so only the grant tells them apart.
    api.grantCategory(chosen, 'STRUCTURES')
    api.modifyUnitState(chosen, { isDamaged: true })
    canonicalizeUnitState(cs.data.attacker)
    expect(api.getUnitState(chosen)?.isDamaged).toBe(true)
    expect(api.getUnitState(other)?.isDamaged).not.toBe(true)
  })

  it('resolves category restrictions per id and retains destroyed metadata', () => {
    const { api } = makeSpace()
    const [ship, ground] = api.system.getUnits('MECH', {
      includeVariants: true,
    })
    api.grantCategory(ship, 'SHIPS')
    api.setUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', 'TEST', 'SHIPS')
    expect(api.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', ship)).toBe(true)
    expect(api.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', ground)).toBe(false)
    api.destroyUnits(ship)
    expect(api.hasUnit(ship)).toBe(false)
    expect(api.isUnitCategory(ship, 'SHIPS')).toBe(true)
  })

  it('adds ordinary hits using participant casualty order', () => {
    const { cs, api } = makeSpace()
    const [mech] = api.system.getUnits('MECH', { includeVariants: true })
    api.grantCategory(mech, 'SHIPS')
    const fighters = api.placeUnits({ FIGHTER: 2 }).FIGHTER
    cs.data.attacker.hitPool = { base: 1, additional: 0, custom: [] }
    api.addHits(1)
    CombatSideState.assignHits(cs.data.attacker)
    expect(fighters.every(id => !api.hasUnit(id))).toBe(true)
    expect(api.hasUnit(mech)).toBe(true)
    expect(
      api.participating.countUnits('CRUISER', { includeVariants: true }),
    ).toBe(1)
  })

  it('canonicalizes a branch without permuting its siblings damage state', () => {
    const { cs, api } = makeSpace()
    const [first, second] = api.system
      .getUnits('MECH', { includeVariants: true })
      .sort()
    api.modifyUnitState(second, { isDamaged: true })
    const fork = cloneStateForBranch(cs.data)
    canonicalizeUnitState(fork.attacker)
    expect(fork.attacker.unitState[first]?.isDamaged).toBe(true)
    expect(api.getUnitState(second)?.isDamaged).toBe(true)
    expect(api.getUnitState(first)?.isDamaged).not.toBe(true)
  })

  it.each([
    ['TI4', 'TITANS_OF_UL', {}],
    ['TI4', 'NEKRO_VIRUS', { NEKRO_UNIT_TITANS_OF_UL_PDS: true }],
    ['TF', 'AVARICE_REX', { TF_UPGRADE_HEL_TITAN: true }],
  ] as const)(
    'automatically joins the first later-placed Hel-Titan (%s, %s)',
    (system, faction, abilities) => {
      const cs = buildCombatState({
        system,
        mode: 'GROUND',
        attacker: { faction, units: { INFANTRY: 1 }, abilities },
        defender: { faction, units: { INFANTRY: 1 } },
      })
      const api = apiFor(cs)
      expect(
        api
          .getAbilityConfig('SUSTAIN_DAMAGE')
          .groundPriority.map(([key]) => key),
      ).toContain('PDS')
      expect(
        api
          .getAbilityConfig('UNIT_PRIORITY')
          .groundUnitPriority.map(([key]) => key),
      ).toContain('PDS')
      const [pds] = api.placeUnits({ PDS: 1 }).PDS
      expect(api.isUnitCategory(pds, 'STRUCTURES')).toBe(true)
      expect(api.isUnitCategory(pds, 'GROUND_FORCES')).toBe(true)
      expect(api.isParticipating(pds)).toBe(true)
    },
  )
})

function reinforcements(call: (ctx: AbilityCallContext) => void): Ability {
  return {
    key: 'TEST_REINFORCEMENTS',
    name: 'Reinforcements',
    side: 'attacker',
    params: { isEnabled: true, uses: 1 },
    invoke: [
      {
        timing: 'START_OF_COMBAT_ROUND',
        isCallable: (_params, ctx) => ctx.side === 'attacker',
        call,
      },
    ],
  }
}

describe('ability selections are snapshots of units', () => {
  it('Alastor excludes new infantry while a new fighter joins normally', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'NEKRO_VIRUS', units: { FLAGSHIP: 1, INFANTRY: 1 } },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      customAbilities: [
        reinforcements(ctx => {
          ctx.api.own.placeUnits({ INFANTRY: 1, FIGHTER: 1 })
        }),
      ],
    })
    const [original] = unitsByBaseType(t.state.attacker).INFANTRY!
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const all = unitsByBaseType(t.state.attacker).INFANTRY!
    expect(all).toHaveLength(2)
    expect(t.dicePool().attacker.INFANTRY).toHaveLength(1)
    expect(t.dicePool().attacker.FIGHTER).toHaveLength(1)
    expect(isUnitCategory(t.state.attacker, original, 'SHIPS')).toBe(true)
    expect(
      isUnitCategory(
        t.state.attacker,
        all.find(id => id !== original)!,
        'SHIPS',
      ),
    ).toBe(false)
  })

  it.each([
    ['Matriarch', 'TI4', 'NAALU_COLLECTIVE', {}],
    ['Morphwing', 'TF', 'AVARICE_REX', { TF_UPGRADE_MORPHWING: true }],
  ] as const)(
    '%s returns selected survivors after the flagship dies, leaving new fighters alone',
    (_name, system, faction, abilities) => {
      let later: UnitId
      const t = combatTest({
        system,
        mode: 'GROUND',
        attacker: {
          faction,
          units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
          abilities,
        },
        defender: { faction, units: { INFANTRY: 1 } },
        customAbilities: [
          reinforcements(ctx => {
            later = ctx.api.own.placeUnits({ FIGHTER: 1 }, SPACE_SURFACE_ID)
              .FIGHTER[0]
            // A separate effect can move a fighter without committing it.
            ctx.api.own.moveUnits(later)
            const flagship = ctx.api.own.system.getUnits('FLAGSHIP', {
              includeVariants: true,
            })[0]
            ctx.api.own.destroyUnits(flagship)
          }),
        ],
      })
      const chosen = unitsByBaseType(t.state.attacker).FIGHTER!
      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ defender: 1 })
      t.advanceTo('COMPLETE')
      expect(t.state.winnerSide).toBe('attacker')
      for (const id of chosen) {
        expect(t.state.attacker.unitSurface[id]).toBe(SPACE_SURFACE_ID)
        expect(isUnitCategory(t.state.attacker, id, 'GROUND_FORCES')).toBe(
          false,
        )
      }
      expect(t.state.attacker.unitSurface[later!]).toBe(DEFAULT_PLANET_ID)
      expect(t.state.attacker.participatingUnits).not.toContain(later!)
    },
  )

  it('Waylay targets all granted mechs', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1, MECH: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: { WAYLAY: true },
      },
      customAbilities: [
        {
          key: 'TEST_PARTICIPATION',
          name: 'Selection',
          params: { isEnabled: true, uses: 1 },
          declareParamChange: () => [{ key: 'SHIPS', value: 'MECH' }],
          invoke: [
            {
              timing: 'START_OF_COMBAT',
              isCallable: (_params, ctx) => ctx.side === 'attacker',
              call: ctx => {
                const mechs = ctx.api.own.system.getUnits('MECH', {
                  includeVariants: true,
                })
                ctx.api.own.grantCategory(mechs, 'SHIPS')
              },
            },
          ],
        },
      ],
    })
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { attacker: 1 })
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH!.filter(unit => unit.isDamaged)).toHaveLength(
      1,
    )
  })

  it('Eidolon Maximum remains a ground force and ignores doubled bombardment hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 5, INFANTRY: 1 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })
    t.advanceTo('GROUND_COMBAT', { defender: 2 })
    const [mech] = unitsByBaseType(t.state.defender).MECH!
    expect(isUnitCategory(t.state.defender, mech, 'GROUND_FORCES')).toBe(true)
    expect(isUnitCategory(t.state.defender, mech, 'SHIPS')).toBe(true)
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).not.toBe(true)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
