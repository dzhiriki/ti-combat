import { describe, expect, it } from 'vitest'

import { hasStaticInvokes, isDeclaredParam } from '@/combat'
import { viscountUnlenn } from '@/data/main/faction/barony_of_letnev/viscount-unlenn'
import { aristocraticGenome } from '@/data/tf/abilities/genome/aristocratic-genome'
import { getGameData } from '@/utils/get-game-data'

describe('Twilight’s Fall cloned abilities', () => {
  // TF's decks are shared, so any faction's available list carries every card.
  const tfRegistered = getGameData('TF').getAvailableAbilities(
    'attacker',
    'AVARICE_REX',
  )
  const tfKeys = new Set(getGameData('TF').allAbilities.map(a => a.key))
  const ti4Keys = new Set(getGameData('TI4').allAbilities.map(a => a.key))

  it('every TF deck card has a TF_-prefixed key of its own', () => {
    for (const r of tfRegistered) {
      if (!r.slot.startsWith('TF_')) continue
      expect(r.ability.key, r.ability.name).toMatch(/^TF_/)
      expect(ti4Keys.has(r.ability.key), r.ability.key).toBe(false)
    }
    expect(tfKeys.has('TF_AMBUSH')).toBe(true)
    expect(tfKeys.has('TF_ALTRUISTIC_GENOME')).toBe(true)
    expect(tfKeys.has('TF_CLOAK')).toBe(true)
  })

  it('does not share invoke objects with the TI4 source', () => {
    if (
      !hasStaticInvokes(aristocraticGenome) ||
      !hasStaticInvokes(viscountUnlenn)
    ) {
      throw new Error('expected static invokes')
    }
    for (const inv of aristocraticGenome.invoke) {
      expect(viscountUnlenn.invoke).not.toContain(inv)
    }
  })

  it('points a self-excluding subtype filter at the clone key', () => {
    const param = aristocraticGenome.params.unitType as unknown
    if (!isDeclaredParam(param)) throw new Error('expected a declared param')
    expect(param.filter?.excludeSubtypeSource).toEqual([
      'TF_ARISTOCRATIC_GENOME',
    ])
    // The TI4 source is untouched.
    const source = viscountUnlenn.params.unitType as unknown
    if (!isDeclaredParam(source)) throw new Error('expected a declared param')
    expect(source.filter?.excludeSubtypeSource).toEqual(['VISCOUNT_UNLENN'])
  })
})
