/**
 * Write a reordered visible list back into the full stored value. Entries the
 * list does not show (choices for another planet) keep their slots; visible
 * slots take the reordered entries in turn, and new ones go last.
 */
export function keepHiddenEntries<T extends readonly [string, ...unknown[]]>(
  value: readonly T[],
  reordered: readonly T[],
): T[] {
  const visible = new Set(reordered.map(([id]) => id))
  const queue = [...reordered]
  const merged = value.map(entry =>
    visible.has(entry[0]) ? queue.shift()! : entry,
  )
  return [...merged, ...queue]
}
