import { describe, expect, it } from 'vitest'

import { layoutPositions, ringOffsets } from '@/async-ti4/map-layout'

/** Every position in a ring-`n` map, plus the off-grid slots. */
function allPositions(rings: number): string[] {
  const out = ['000']
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 1; i <= 6 * ring; i++) {
      out.push(`${ring}${String(i).padStart(2, '0')}`)
    }
  }
  out.push('tl', 'tr', 'bl', 'br')
  for (let i = 1; i <= 7; i++) out.push(`frac${i}`)
  return out
}

describe('ringOffsets', () => {
  it('walks a ring of 6n tiles starting from the top', () => {
    // Spot values taken from the position table AsyncTI4 ships.
    expect(ringOffsets(1)).toEqual([
      [0, -2],
      [1, -1],
      [1, 1],
      [0, 2],
      [-1, 1],
      [-1, -1],
    ])
    expect(ringOffsets(2)[4]).toEqual([2, 2]) // 205
    expect(ringOffsets(3)[12]).toEqual([-3, 3]) // 313
  })

  it('scales to any ring, which is what 7- and 8-player maps need', () => {
    for (const ring of [1, 3, 4, 5, 12, 21]) {
      const offsets = ringOffsets(ring)
      expect(offsets).toHaveLength(6 * ring)
      expect(new Set(offsets.map(String)).size).toBe(offsets.length)
    }
  })
})

describe('layoutPositions', () => {
  // A column of flat-top hexes only ever holds half-rows of its own parity.
  // Anything else floats between rows when drawn.
  function offLattice(cells: { col: number; halfRow: number }[]) {
    return cells.filter(c => Math.abs(c.col % 2) !== Math.abs(c.halfRow % 2))
  }

  it.each([3, 4, 5])('places a %i-ring map on the lattice', rings => {
    const layout = layoutPositions(allPositions(rings), rings)

    expect(offLattice(layout.cells)).toEqual([])
    const keys = layout.cells.map(c => `${c.col},${c.halfRow}`)
    expect(new Set(keys).size).toBe(keys.length) // no two tiles share a cell
    expect(layout.cells).toHaveLength(allPositions(rings).length)
  })

  it('keeps the corner slots inside the grid, not beside it', () => {
    // Disconnected home systems — Mallice, Creuss, Crimson Rebellion — go in
    // the bounding box corners a hex ring map leaves empty, so they cost no
    // width. Only the fracture strip makes the map taller.
    const rings = 3
    const grid = layoutPositions(
      allPositions(rings).filter(p => !p.startsWith('frac')),
      rings,
    )
    const gridOnly = layoutPositions(
      allPositions(rings).filter(
        p => !p.startsWith('frac') && !['tl', 'tr', 'bl', 'br'].includes(p),
      ),
      rings,
    )
    expect(grid.width).toBe(gridOnly.width)
    expect(grid.height).toBe(gridOnly.height)
  })

  it('reports what it cannot place rather than guessing', () => {
    const layout = layoutPositions(['301', 'special', 'frac4', 'nonsense'], 3)
    expect(layout.cells.map(c => c.position)).toEqual(['301', 'frac4'])
    expect(layout.unplaced).toEqual(['special', 'nonsense'])
  })
})
