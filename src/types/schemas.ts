import { z } from 'zod/mini'

import { isValidUnitLocator } from '@/combat/utils/unit-locator'

export const UnitLocatorSchema = z
  .string()
  .check(z.refine(isValidUnitLocator, 'Invalid surface unit selection'))

/** Zod schema for `UnitList` (order-mode list). Accepts either `[K][]`
 *  1-tuples or a flat `K[]` array — `unwrapUnitListKeys` normalizes both
 *  shapes at runtime, and the URL codec round-trips order-mode lists as
 *  flat strings since there's nothing to pair the keys with. */
export const UnitListSchema = z.union([
  z.array(z.tuple([UnitLocatorSchema])),
  z.array(UnitLocatorSchema),
])

/** Zod schema for `UnitList<boolean>` (checkbox-mode tuple-array). */
export const UnitListBooleanSchema = z.array(
  z.tuple([UnitLocatorSchema, z.boolean()]),
)

/** Zod schema for `UnitList<number>` (number-mode tuple-array). */
export const UnitListNumberSchema = z.array(
  z.tuple([UnitLocatorSchema, z.number()]),
)
