import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AbilitiesPanel } from '@/components/abilities-panel'
import { CombatSetup } from '@/hooks/combat-setup'
import type { CollectedAbility } from '@/types'
import { getGameData } from '@/utils/get-game-data'

function ability(
  name: string,
  slot: string,
  factionKey?: string,
): CollectedAbility {
  return {
    key: name,
    name,
    slot,
    factionKey,
    icon: `<svg data-icon="${name}"></svg>`,
    headerUI: 'isEnabled',
    params: { isEnabled: false, uses: Infinity },
    invoke: [],
  }
}

describe('abilities panel slot layout', () => {
  const setup = new CombatSetup()
  // Registration order deliberately differs from panel order.
  const abilities = [
    ability('Driver', 'ADVANCED'),
    ability('Other agent', 'FACTION_AGENT', 'OTHER_FACTION'),
    ability('Own agent', 'FACTION_AGENT', 'ARBOREC'),
    ability('Other commander', 'FACTION_COMMANDER', 'OTHER_FACTION'),
    ability('Own commander', 'FACTION_COMMANDER', 'ARBOREC'),
    ability('Cruiser text', 'FACTION_CRUISER', 'ARBOREC'),
    ability('Destroyer text', 'FACTION_DESTROYER', 'ARBOREC'),
  ]
  const render = (
    overrides: Partial<ComponentProps<typeof AbilitiesPanel>> = {},
  ) =>
    renderToStaticMarkup(
      <AbilitiesPanel
        abilities={abilities}
        slots={getGameData('TI4').slots}
        factionKey="ARBOREC"
        readContext={setup.getReadContext('attacker')}
        combatMode="SPACE"
        params={{}}
        onParamsChange={() => {}}
        filterMode="all"
        {...overrides}
      />,
    )

  it('renders leaders once in their own or shared sections, in config order', () => {
    const html = render()
    const headings = [...html.matchAll(/<h6[^>]*>([^<]*)<\/h6>/g)].map(
      match => match[1],
    )
    expect(headings).toEqual(['FACTION', 'AGENT', 'COMMANDER', 'ADVANCED'])
    const names = [
      'Own agent',
      'Own commander',
      'Cruiser text',
      'Destroyer text',
      'Other agent',
      'Other commander',
      'Driver',
    ]
    const positions = names.map(name => {
      expect(html.split(`>${name}<`)).toHaveLength(2)
      return html.indexOf(`>${name}<`)
    })
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(html.split('>UNIT<')).toHaveLength(2)
    expect(abilities[0].name).toBe('Driver')
  })

  it('takes icon visibility from the matching slot entry', () => {
    const html = render()
    expect(html).not.toContain('data-icon="Own agent"')
    expect(html).not.toContain('data-icon="Own commander"')
    expect(html).toContain('data-icon="Other agent"')
    expect(html).toContain('data-icon="Other commander"')
    expect(html).toContain('data-icon="Cruiser text"')
  })

  it('searches category and subcategory titles without leaving empty sections', () => {
    const html = render({ searchQuery: 'faction agent' })
    expect(html).toContain('>Own agent<')
    expect(html).not.toContain('>Other agent<')
    expect(html).not.toContain('>COMMANDER<')
    expect(html).not.toContain('>ADVANCED<')
    expect(render({ searchQuery: 'no-such-ability' })).not.toContain('<h6')
  })

  it('honors inherited Neutral rules and item overrides', () => {
    const html = render({
      factionKey: 'NEUTRAL',
      slots: [
        {
          title: 'Custom',
          neutral: false,
          icon: false,
          items: [
            { title: 'Hidden', slot: 'FACTION_AGENT', strategy: 'ALL' },
            { title: 'Visible', slot: 'ADVANCED', neutral: true, icon: true },
          ],
        },
      ],
    })
    expect(html).toContain('>Driver<')
    expect(html).toContain('data-icon="Driver"')
    expect(html).not.toContain('>Other agent<')
    expect(html).not.toContain('>Hidden<')
  })
})
