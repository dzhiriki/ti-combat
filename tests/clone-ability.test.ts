import { describe, expect, it } from 'vitest'

import { type Ability, cloneAbility, hasStaticInvokes } from '@/combat'

describe('cloneAbility', () => {
  it('clones structure and static invokes without changing ability policy', () => {
    const source: Ability = {
      key: 'SOURCE',
      name: 'Source',
      params: { isEnabled: true, uses: Infinity },
      readOnly: true,
      invoke: [{ timing: 'PREPARE', call: () => {} }],
    }

    const cloned = cloneAbility(source, { key: 'CLONE', name: 'Clone' })

    expect(cloned).toMatchObject({
      key: 'CLONE',
      name: 'Clone',
      readOnly: true,
      params: source.params,
    })
    expect(cloned.headerUI).toBeUndefined()
    expect(cloned.params).toBe(source.params)
    expect(hasStaticInvokes(cloned)).toBe(true)
    if (!hasStaticInvokes(cloned) || !hasStaticInvokes(source)) return
    expect(cloned.invoke).not.toBe(source.invoke)
    expect(cloned.invoke[0]).not.toBe(source.invoke[0])
    expect(cloned.invoke[0].call).toBe(source.invoke[0].call)
  })
})
