import { beforeEach, describe, expect, it } from 'vitest'

import {
  createDefaultSurfaces,
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
  type UnitId,
  type UnitIdList,
} from '@/types'

import {
  buildCombatDiceRollGroup,
  buildUnitAbilityDiceRollGroup,
  CombatState,
} from '../../combat-state/combat-state'
import type {
  CombatStateData,
  DiceRollContext,
  PhaseStep,
  SideStateData,
} from '../../combat-state/types'
import { isDiceRollContext } from '../../combat-state/types'
import type { Ability } from '../types'
import { AbilityContext } from './ability-api'

function makeSide(): SideStateData {
  return {
    faction: 'FEDERATION_OF_SOL',
    participatingUnits: '' as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: { space: '' as UnitIdList },
    unitSurface: {},
    unitType: {},
    unitState: {},
    unitStats: {} as SideStateData['unitStats'],
    abilities: {},
    liveAbilities: {},
  }
}

function makeCombatState(): CombatState {
  const data: CombatStateData = {
    attacker: makeSide(),
    defender: makeSide(),
    combatMode: 'SPACE',
    surfaces: createDefaultSurfaces(),
    activeSurfaceId: SPACE_SURFACE_ID,
  }
  return CombatState.fromDataStandalone(data)
}

function makeAbility(key = 'TEST_ABILITY'): Ability {
  return {
    key,
    name: 'Test Ability',
    params: { isEnabled: true, uses: Infinity },
    invoke: [],
  }
}

/** Push a dice-roll group on top of pendingSteps so `currentGroupData`
 *  returns a `DiceRollContext`. */
function pushDiceRollGroup(cs: CombatState): DiceRollContext {
  cs.pendingSteps.push(buildCombatDiceRollGroup({ phase: ['SPACE_COMBAT'] }))
  const ctx = cs.currentGroupData
  if (!isDiceRollContext(ctx)) throw new Error('expected DiceRollContext')
  return ctx
}

function withAbility(
  cs: CombatState,
  side: 'attacker' | 'defender' = 'attacker',
) {
  // AbilityContext owns the ability; `ctx.api.own` is the SideApi bound to
  // `side`. (`opponent` is the other side regardless of which we pass in.)
  const ctx = new AbilityContext(side, cs.params)
  const ability = makeAbility()
  ctx.upgradeForCall(ability)
  return { ctx, api: ctx.api.own, ability }
}

describe('SideApi unit query scopes', () => {
  it('separates units on the active surface from participants', () => {
    const cs = makeCombatState()
    const cruiserId = 'a' as UnitId
    const infantryId = 'b' as UnitId
    const pdsId = 'c' as UnitId
    const side = cs.data.attacker

    side.participatingUnits = `${cruiserId}${infantryId}` as UnitIdList
    side.nonParticipatingUnits = `${pdsId}` as UnitIdList
    side.surfaceUnits = {
      [SPACE_SURFACE_ID]: `${cruiserId}` as UnitIdList,
      [DEFAULT_PLANET_ID]: `${infantryId}${pdsId}` as UnitIdList,
    }
    side.unitSurface = {
      [cruiserId]: SPACE_SURFACE_ID,
      [infantryId]: DEFAULT_PLANET_ID,
      [pdsId]: DEFAULT_PLANET_ID,
    }
    side.unitType = {
      [cruiserId]: 'CRUISER',
      [infantryId]: 'INFANTRY',
      [pdsId]: 'PDS',
    }
    cs.data.activeSurfaceId = DEFAULT_PLANET_ID

    const { api } = withAbility(cs)
    const exact = { includeVariants: false }

    expect(api.surface.getUnits('PDS', exact)).toEqual([pdsId])
    expect(api.surface.countUnits(undefined, exact)).toBe(2)
    expect(api.surface.hasUnitType('CRUISER', exact)).toBe(false)
    expect(api.surface.getUnitTypes()).toEqual(['INFANTRY', 'PDS'])
    expect(api.surface.findUnitByPriority(['PDS', 'INFANTRY'], exact)).toBe(
      pdsId,
    )

    expect(api.participating.getUnits('CRUISER', exact)).toEqual([cruiserId])
    expect(api.participating.countUnits(undefined, exact)).toBe(2)
    expect(api.participating.hasUnitType('PDS', exact)).toBe(false)
    expect(api.participating.getUnitTypes()).toEqual(['CRUISER', 'INFANTRY'])
    expect(
      api.participating.findUnitByPriority(['PDS', 'INFANTRY'], exact),
    ).toBe(infantryId)

    expect(api.participating.getAssignHitsTargets(1)).toEqual([infantryId])
    expect(side.participatingUnits).toBe(`${cruiserId}${infantryId}`)

    cs.data.activeSurfaceId = SPACE_SURFACE_ID
    expect(api.surface.getUnits('CRUISER', exact)).toEqual([cruiserId])
    expect(api.surface.countUnits(undefined, exact)).toBe(1)
  })
})

describe('SideApi.declareRollTrigger', () => {
  let cs: CombatState
  beforeEach(() => {
    cs = makeCombatState()
  })

  it('throws when called outside a dice-roll group', () => {
    const { api } = withAbility(cs)
    expect(() =>
      api.declareRollTrigger({
        unitType: [],
        faces: [10],
        effect: () => {},
      }),
    ).toThrow(/dice-roll group/)
  })

  it('throws when called outside an ability context', () => {
    pushDiceRollGroup(cs)
    const ctx = new AbilityContext('attacker', cs.params)
    const api = ctx.api.own
    expect(() =>
      api.declareRollTrigger({
        unitType: [],
        faces: [10],
        effect: () => {},
      }),
    ).toThrow(/ability context/)
  })

  it('pushes a fully-filled entry with slotId 0 on first call', () => {
    const ctx = pushDiceRollGroup(cs)
    const { api, ability } = withAbility(cs, 'attacker')
    const effect = () => {}
    api.declareRollTrigger({ unitType: [], faces: [10], effect })
    expect(ctx.modifiers).toEqual([
      {
        type: 'ROLL_TRIGGER',
        slotId: 0,
        side: 'attacker',
        abilityKey: ability.key,
        unitType: [],
        faces: [10],
        effect,
      },
    ])
  })

  it('assigns slotId 1 to a second call', () => {
    const ctx = pushDiceRollGroup(cs)
    const { api } = withAbility(cs, 'attacker')
    api.declareRollTrigger({ unitType: [], faces: [10], effect: () => {} })
    api.declareRollTrigger({ unitType: [], faces: [9], effect: () => {} })
    expect(ctx.modifiers).toHaveLength(2)
    expect(ctx.modifiers![0].slotId).toBe(0)
    expect(ctx.modifiers![1].slotId).toBe(1)
  })
})

describe('SideApi.applyConditionalBonusToResult', () => {
  let cs: CombatState
  beforeEach(() => {
    cs = makeCombatState()
  })

  it('throws when called outside a dice-roll group', () => {
    const { api } = withAbility(cs)
    expect(() => api.applyConditionalBonusToResult({ amount: 1 })).toThrow(
      /dice-roll group/,
    )
  })

  it('throws when called outside an ability context', () => {
    pushDiceRollGroup(cs)
    const ctx = new AbilityContext('attacker', cs.params)
    const api = ctx.api.own
    expect(() => api.applyConditionalBonusToResult({ amount: 1 })).toThrow(
      /ability context/,
    )
  })

  it('pushes a filled entry with slotId 0', () => {
    const ctx = pushDiceRollGroup(cs)
    const { api, ability } = withAbility(cs, 'defender')
    api.applyConditionalBonusToResult({ amount: 2 })
    expect(ctx.modifiers).toEqual([
      {
        type: 'CONDITIONAL_MODIFIER',
        slotId: 0,
        side: 'defender',
        ownerSide: 'defender',
        abilityKey: ability.key,
        amount: 2,
      },
    ])
  })

  it('assigns slotId 1 to a second call', () => {
    const ctx = pushDiceRollGroup(cs)
    const { ctx: abilityCtx } = withAbility(cs)
    abilityCtx.api.own.applyConditionalBonusToResult({ amount: 1 })
    abilityCtx.api.opponent.applyConditionalBonusToResult({ amount: -1 })
    expect(ctx.modifiers).toHaveLength(2)
    expect(ctx.modifiers![1].slotId).toBe(1)
  })
})

describe('SideApi.declareReroll', () => {
  let cs: CombatState
  beforeEach(() => {
    cs = makeCombatState()
  })

  it('throws when called outside a dice-roll group', () => {
    const { api } = withAbility(cs)
    expect(() => api.declareReroll({ target: 'MISSES' })).toThrow(
      /dice-roll group/,
    )
  })

  it('throws when called outside an ability context', () => {
    pushDiceRollGroup(cs)
    const ctx = new AbilityContext('attacker', cs.params)
    const api = ctx.api.own
    expect(() => api.declareReroll({ target: 'MISSES' })).toThrow(
      /ability context/,
    )
  })

  it('pushes a filled entry with slotId 0', () => {
    const ctx = pushDiceRollGroup(cs)
    const { api, ability } = withAbility(cs, 'attacker')
    api.declareReroll({ target: 'MISSES' })
    expect(ctx.modifiers).toHaveLength(1)
    expect(ctx.modifiers![0]).toMatchObject({
      type: 'REROLL',
      slotId: 0,
      side: 'attacker',
      abilityKey: ability.key,
      target: 'MISSES',
    })
  })

  it('assigns slotId 1 to a second call', () => {
    const ctx = pushDiceRollGroup(cs)
    const { api } = withAbility(cs)
    api.declareReroll({ target: 'MISSES' })
    api.declareReroll({ target: 'MISSES' })
    expect(ctx.modifiers).toHaveLength(2)
    expect(ctx.modifiers![1].slotId).toBe(1)
  })
})

describe('SideApi.discardCurrentGroupScript', () => {
  it('pops the top dice-roll group and clears hitPool on both sides', () => {
    const cs = makeCombatState()
    pushDiceRollGroup(cs)
    cs.data.attacker.hitPool = { base: 1, additional: 0, custom: [] }
    cs.data.defender.hitPool = { base: 2, additional: 0, custom: [] }
    const { api } = withAbility(cs, 'attacker')
    api.discardCurrentGroupScript()
    expect(cs.pendingSteps).toHaveLength(0)
    expect(cs.data.attacker.hitPool).toBeUndefined()
    expect(cs.data.defender.hitPool).toBeUndefined()
  })

  it('still clears hitPool when top is not a group', () => {
    const cs = makeCombatState()
    const step: PhaseStep = {
      kind: 'timing',
      timing: 'START_OF_COMBAT_ROUND',
      phase: ['SPACE_COMBAT'],
    }
    cs.pendingSteps.push(step)
    cs.data.attacker.hitPool = { base: 1, additional: 0, custom: [] }
    const { api } = withAbility(cs)
    api.discardCurrentGroupScript()
    // Standalone step is left in place — only groups get popped.
    expect(cs.pendingSteps).toEqual([step])
    expect(cs.data.attacker.hitPool).toBeUndefined()
  })
})

describe('SideApi.pushSteps', () => {
  it('appends steps in execution order (LIFO via pushScript)', () => {
    const cs = makeCombatState()
    const stepA: PhaseStep = {
      kind: 'timing',
      timing: 'START_OF_COMBAT_ROUND',
      phase: ['SPACE_COMBAT'],
    }
    const stepB: PhaseStep = {
      kind: 'timing',
      timing: 'END_OF_COMBAT_ROUND',
      phase: ['SPACE_COMBAT'],
    }
    const { api } = withAbility(cs)
    api.pushSteps([stepA, stepB])
    // pushScript reverses execution order, so stepA ends up on top
    // (pops first), then stepB.
    expect(cs.pendingSteps).toHaveLength(2)
    expect(cs.peekStep()).toBe(stepA)
  })
})

describe('AbilityContext.resolveStep', () => {
  it('maps OWN and OPPONENT firing sides relative to the caller', () => {
    const cs = makeCombatState()
    cs.pendingSteps.push({
      kind: 'timing',
      timing: 'AFB_STEP',
      phase: ['SPACE_COMBAT'],
    })
    const { ctx } = withAbility(cs, 'defender')

    ctx.resolveStep('AFB', { firing: ['OWN', 'OPPONENT'] })

    const group = cs.pendingSteps.at(-1)
    if (!group || group.kind !== 'group' || !isDiceRollContext(group.data)) {
      throw new Error('expected DiceRollContext')
    }
    expect(group.data.firing).toEqual(['defender', 'attacker'])
  })
})

describe('AbilityContext dice-roll group getters', () => {
  let cs: CombatState
  beforeEach(() => {
    cs = makeCombatState()
  })

  it('currentDiceRollPhase returns the group phase inside; throws outside', () => {
    const { ctx } = withAbility(cs)
    expect(() => ctx.currentDiceRollPhase).toThrow(/dice-roll group/)
    pushDiceRollGroup(cs)
    expect(ctx.currentDiceRollPhase).toEqual(['SPACE_COMBAT'])
  })

  it('currentDiceRollFiring returns DiceRollContext.firing; throws outside', () => {
    const { ctx } = withAbility(cs)
    expect(() => ctx.currentDiceRollFiring).toThrow(/dice-roll group/)
    pushDiceRollGroup(cs)
    expect(ctx.currentDiceRollFiring).toEqual(['attacker', 'defender'])
  })

  it('currentDiceRollHitSource returns DiceRollContext.hitSource; throws outside', () => {
    const { ctx } = withAbility(cs)
    expect(() => ctx.currentDiceRollHitSource).toThrow(/dice-roll group/)
    pushDiceRollGroup(cs)
    expect(ctx.currentDiceRollHitSource).toBe('COMBAT')
  })

  it('currentDiceRollSelfTarget returns DiceRollContext.selfTarget; throws outside', () => {
    const { ctx } = withAbility(cs)
    expect(() => ctx.currentDiceRollSelfTarget).toThrow(/dice-roll group/)
    // Default group is not self-target.
    pushDiceRollGroup(cs)
    expect(ctx.currentDiceRollSelfTarget).toBe(false)

    // Replace top with a unit-ability group flagged self-target
    // (combat rolls are never self-target).
    cs.pendingSteps.pop()
    cs.pendingSteps.push(
      buildUnitAbilityDiceRollGroup({
        phase: ['SPACE_CANNON_OFFENSE'],
        firing: ['attacker'],
        hitSource: 'SPACE_CANNON',
        selfTarget: true,
      }),
    )
    expect(ctx.currentDiceRollSelfTarget).toBe(true)
  })

  it('currentDiceRollIsUnitAbility returns DiceRollContext.isUnitAbility; throws outside', () => {
    const { ctx } = withAbility(cs)
    expect(() => ctx.currentDiceRollIsUnitAbility).toThrow(/dice-roll group/)
    pushDiceRollGroup(cs)
    expect(ctx.currentDiceRollIsUnitAbility).toBe(false)

    cs.pendingSteps.pop()
    cs.pendingSteps.push(
      buildUnitAbilityDiceRollGroup({
        phase: ['AFB'],
        firing: ['attacker'],
        hitSource: 'AFB',
      }),
    )
    expect(ctx.currentDiceRollIsUnitAbility).toBe(true)
  })
})
