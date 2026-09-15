import { afterEach, beforeEach, describe, it } from 'vitest'

import { setReversed } from './combat-test'

function itForEachSide(name: string, fn: () => void | Promise<void>) {
  it(name, () => {
    setReversed(false)
    return fn()
  })
  it(`[reversed] ${name}`, async () => {
    setReversed(true)
    try {
      await fn()
    } finally {
      setReversed(false)
    }
  })
}

function describeForEachSide(name: string, fn: () => void) {
  describe(`${name}`, fn)
  describe(`[reversed] ${name}`, () => {
    beforeEach(() => {
      setReversed(true)
    })
    afterEach(() => {
      setReversed(false)
    })
    fn()
  })
}

// oxlint-disable-next-line typescript/no-explicit-any
;(it as any).forEachSide = itForEachSide
// oxlint-disable-next-line typescript/no-explicit-any
;(describe as any).forEachSide = describeForEachSide
