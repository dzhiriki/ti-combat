import type { UnitId } from '@/types'

// Start above the ASCII range so that a UnitId, appearing as a single
// char in a packed string, never collides with the separators, markers or
// damage flags used in `getUnitsHash`.
const INITIAL_CODE = 0x80

/** Container that owns a UnitId allocation counter. `SideStateData`
 *  satisfies this structurally; initial-setup builders pass a transient
 *  `{}` and copy the resulting `_nextCode` onto the side they're building. */
export interface UnitIdGenerator {
  _nextCode?: number
}

/** Generate an array of N consecutive UnitIds (each a single-char string),
 *  pulling from `gen`'s counter. Equivalent branches that share a parent's
 *  generator value mint identical IDs, so post-placement state hashes
 *  converge across sibling branches. */
export function nextUnitIds(count: number, gen: UnitIdGenerator): UnitId[] {
  let code = gen._nextCode ?? INITIAL_CODE
  const result: UnitId[] = []
  for (let i = 0; i < count; i++) {
    result.push(String.fromCharCode(code++) as UnitId)
  }
  gen._nextCode = code
  return result
}
