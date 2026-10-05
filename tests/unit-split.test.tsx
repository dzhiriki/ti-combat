import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import {
  splitGroups,
  UnitSplit,
} from '@/components/abilities-panel/components/unit-split'
import { moveThumbs } from '@/components/ui/split-slider'
import { SPACE_SURFACE_ID } from '@/types'

import { PLANET_1, PLANET_2 } from './utils/surface-units'

const at = makeUnitLocator

const item = (type: string, surfaceId: string, surfaceName: string) => ({
  label: type,
  value: at(type as never, surfaceId as never),
  surfaceName,
})

describe('unit split control', () => {
  const items = [
    item('FIGHTER', PLANET_1, 'Planet 1'),
    item('FIGHTER', PLANET_2, 'Planet 2'),
    item('FIGHTER', SPACE_SURFACE_ID, 'Space'),
    item('MECH', PLANET_1, 'Planet 1'),
  ]

  it('splits only types with somewhere else to go', () => {
    expect(splitGroups(items).map(group => group[0].label)).toEqual(['FIGHTER'])
  })

  it('shows one thumb per border and each segment count', () => {
    const html = renderToStaticMarkup(
      <UnitSplit
        items={items}
        value={[
          [at('FIGHTER', PLANET_1), 3],
          [at('FIGHTER', PLANET_2), 1],
          [at('FIGHTER', SPACE_SURFACE_ID), 2],
        ]}
        onChange={() => {}}
      />,
    )

    expect(html.split('role="slider"')).toHaveLength(3)
    for (const [label, count] of [
      ['Planet 1', 3],
      ['Planet 2', 1],
      ['Space', 2],
    ])
      expect(html).toMatch(new RegExp(`>${label}<.*?>${count}<`))
    expect(html).not.toContain('MECH')
  })

  it('stops a thumb where a segment would exceed its max', () => {
    const segments = [
      { label: 'Planet 1', value: 5 },
      { label: 'Space', value: 10, max: 10 },
    ]

    expect(moveThumbs(segments, [2])).toEqual([5, 10])
    expect(moveThumbs(segments, [8])).toEqual([8, 7])
  })
})
