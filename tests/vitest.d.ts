import type { SuiteAPI, TestAPI } from 'vitest'

import type { StateWithProbability } from '@/combat'

declare module 'vitest' {
  interface ForEachSideIt {
    forEachSide(name: string, fn: () => void | Promise<void>): void
  }

  interface ForEachSideDescribe {
    forEachSide(name: string, fn: () => void): void
  }

  export const it: TestAPI & ForEachSideIt
  export const describe: SuiteAPI & ForEachSideDescribe

  // oxlint-disable-next-line typescript/no-empty-object-type
  interface Matchers<R, T> extends CustomMatchers<R> {}
}

interface BranchSpec<X> {
  value: X
  predicate?: (branch: StateWithProbability) => boolean
  probability: number
}

interface CustomMatchers<R = unknown> {
  toContainDice(source: string, ...expected: [number, number][]): R
  toHaveBranches<X>(
    extractor: (branch: StateWithProbability) => X,
    specs: BranchSpec<X>[],
  ): R
}
