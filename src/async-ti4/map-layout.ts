/** Placing AsyncTI4 map positions on a hex grid.
 *
 *  Coordinates are `col` (hex columns) and `halfRow` (half a hex height), the
 *  units AsyncTI4's own map uses. Flat-top hexes: neighbouring columns are
 *  three-quarters of a hex apart and offset by half a hex vertically, so a
 *  column only ever holds cells whose `halfRow` matches its own parity.
 */

/** Source-art proportions, kept so a caller can size a hex however it likes
 *  and still lay the grid out correctly. */
export const HEX_WIDTH = 345
export const HEX_HEIGHT = 300
export const COL_PITCH = 260
export const HALF_ROW_PITCH = 150

export interface MapCell {
  /** AsyncTI4 position id, e.g. `301`, `frac4`, `tl`. */
  position: string
  col: number
  halfRow: number
}

/** The six directions of a hex ring walk, in column / half-row steps. */
const LEGS: readonly (readonly [number, number])[] = [
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
  [0, -2],
  [1, -1],
]

/** Every position in a ring, in AsyncTI4's numbering order: start at the top
 *  and walk clockwise, six legs of `ring` steps each. Verified against the
 *  full position table AsyncTI4 ships, rings 1 to 21. */
export function ringOffsets(ring: number): [number, number][] {
  if (ring <= 0) return [[0, 0]]
  const out: [number, number][] = []
  let col = 0
  let halfRow = -2 * ring
  for (const [dc, dr] of LEGS) {
    for (let step = 0; step < ring; step++) {
      out.push([col, halfRow])
      col += dc
      halfRow += dr
    }
  }
  return out
}

/** Split a numeric position into its ring and its index within that ring.
 *  Rings past 9 use two digits for the ring, so the index is always the last
 *  two characters. */
function parseRingPosition(
  position: string,
): { ring: number; index: number } | null {
  if (!/^\d{3,4}$/.test(position)) return null
  const ring = Number(position.slice(0, -2))
  const index = Number(position.slice(-2))
  if (!Number.isFinite(ring) || !Number.isFinite(index)) return null
  return { ring, index }
}

/** The seven fracture tiles, as a chevron: column, then half-rows above the
 *  strip's baseline. The rise changes by one half-row per column, which is
 *  what keeps the chevron on the lattice — neighbouring columns hold opposite
 *  parities, so an even step would leave every other tile floating between
 *  rows. */
const FRACTURE_SHAPE: readonly (readonly [number, number])[] = [
  [-3, 0],
  [-2, -1],
  [-1, -2],
  [0, -3],
  [1, -2],
  [2, -1],
  [3, 0],
]

const CORNER_SLOTS = ['tl', 'tr', 'bl', 'br'] as const

/** Where a position sits, or `null` when there is nowhere sensible to put it.
 *
 *  `ring` is the map's ring count, which decides where the off-grid slots go:
 *  the four corner slots (holding whatever is disconnected from the map —
 *  Mallice, the Creuss home, Crimson Rebellion's) drop into the corners of the
 *  grid's bounding box, which a hex ring map always leaves empty, and the
 *  fracture sits in its own strip above. */
function placePosition(
  position: string,
  ring: number,
): [number, number] | null {
  const parsed = parseRingPosition(position)
  if (parsed) {
    if (parsed.ring === 0) return [0, 0]
    const offsets = ringOffsets(parsed.ring)
    return offsets[parsed.index - 1] ?? null
  }

  const corner = CORNER_SLOTS.indexOf(position as (typeof CORNER_SLOTS)[number])
  if (corner !== -1) {
    // One short of the bounding box corner, which keeps the slot on the
    // lattice (a column only holds half-rows of its own parity) without
    // making the map any larger.
    const col = corner % 2 === 0 ? -ring : ring
    // Sit at the bounding box edge, stepped in by one where that is the only
    // way to match the column's parity. Either way the map gets no larger.
    const magnitude = ring % 2 === 0 ? 2 * ring : 2 * ring - 1
    return [col, corner < 2 ? -magnitude : magnitude]
  }

  const fracture = /^frac([1-7])$/.exec(position)
  if (fracture) {
    const [col, rise] = FRACTURE_SHAPE[Number(fracture[1]) - 1]
    // One half-row clear of the top of the grid. The odd baseline keeps the
    // chevron's ends on the lattice whatever the ring count.
    return [col, -(2 * ring + 1) + rise]
  }

  return null
}

export interface MapLayout {
  cells: MapCell[]
  /** Positions with no place on the grid, for a caller to offer some other
   *  way — AsyncTI4 leaves these off its own map too. */
  unplaced: string[]
  minCol: number
  maxCol: number
  minHalfRow: number
  maxHalfRow: number
  /** Extent in source-art units, for sizing a viewport. */
  width: number
  height: number
}

/** Lay out a game's positions. Ring count comes from the payload, so 6-player
 *  three-ring maps and the larger 7- and 8-player ones need no special case. */
export function layoutPositions(
  positions: readonly string[],
  ringCount: number,
): MapLayout {
  const ring = Math.max(1, Math.trunc(ringCount) || 1)
  const cells: MapCell[] = []
  const unplaced: string[] = []

  for (const position of positions) {
    const placed = placePosition(position, ring)
    if (!placed) {
      unplaced.push(position)
      continue
    }
    cells.push({ position, col: placed[0], halfRow: placed[1] })
  }

  const cols = cells.map(c => c.col)
  const halfRows = cells.map(c => c.halfRow)
  const minCol = cols.length ? Math.min(...cols) : 0
  const maxCol = cols.length ? Math.max(...cols) : 0
  const minHalfRow = halfRows.length ? Math.min(...halfRows) : 0
  const maxHalfRow = halfRows.length ? Math.max(...halfRows) : 0

  return {
    cells,
    unplaced,
    minCol,
    maxCol,
    minHalfRow,
    maxHalfRow,
    width: (maxCol - minCol) * COL_PITCH + HEX_WIDTH,
    height: (maxHalfRow - minHalfRow) * HALF_ROW_PITCH + HEX_HEIGHT,
  }
}
