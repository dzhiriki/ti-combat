import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { List } from '@/components/abilities-panel/components/list'
import {
  hasFixedSingleUse,
  PlanetUses,
  planetUsesTitle,
} from '@/components/abilities-panel/components/planet-uses'
import { CombatSetup } from '@/hooks/combat-setup'
import { cappablePlanets } from '@/utils/cappable-planets'

import { PLANET_1, PLANET_2 } from './utils/surface-units'

const ability = (overrides: Partial<Ability> = {}): Ability => ({
  key: 'TEST',
  name: 'Test',
  params: { isEnabled: true, uses: 2 },
  invoke: [{ timing: 'START_OF_COMBAT_ROUND', call: () => {} }],
  ...overrides,
})

function groundSetup(planets: number): CombatSetup {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  for (let i = 1; i < planets; i++) setup.addPlanet()
  return setup
}

describe('planet uses control', () => {
  const setup = groundSetup(2)
  const ctx = setup.getReadContext('attacker')
  const planets = (item: Ability, uses = 2) =>
    cappablePlanets(item, { ...item.params, uses }, ctx)?.map(p => p.id)
  const registered = (key: string) =>
    setup.getAvailableAbilities('attacker').find(item => item.key === key)!

  it('caps limited uses on every planet of an invasion', () => {
    expect(planets(ability())).toEqual([PLANET_1, PLANET_2])
    expect(planets(registered('MORALE_BOOST'))).toEqual([PLANET_1, PLANET_2])
  })

  it('skips abilities used once for the whole system', () => {
    expect(planets(registered('BLITZ'), 1)).toBeUndefined()
    const once = ability({ invoke: [{ timing: 'PREPARE', call: () => {} }] })
    expect(planets(once)).toBeUndefined()
    const system = ability({
      invoke: [{ timing: 'START_OF_COMBAT', system: true, call: () => {} }],
    })
    expect(planets(system)).toBeUndefined()
  })

  it('offers planets before any uses are set', () => {
    expect(planets(ability(), 0)).toEqual([PLANET_1, PLANET_2])
  })

  it('skips unlimited, space and read-only abilities', () => {
    expect(planets(ability(), Infinity)).toBeUndefined()
    expect(planets(ability({ context: 'SPACE' }))).toBeUndefined()
    expect(planets(ability({ readOnly: true }))).toBeUndefined()
  })

  it('needs more than one planet', () => {
    const item = ability()
    expect(
      cappablePlanets(
        item,
        item.params,
        groundSetup(1).getReadContext('attacker'),
      ),
    ).toBeUndefined()
  })

  it('steps a cap up to its max, then to no limit', () => {
    const html = renderToStaticMarkup(
      <List
        mode="number"
        optional
        items={[
          { label: 'Planet 1', value: PLANET_1, max: 2 },
          { label: 'Planet 2', value: PLANET_2, max: 2 },
        ]}
        value={[[PLANET_2, 1]]}
        onChange={() => {}}
      />,
    )

    const inputs = [...html.matchAll(/<input[^>]*>/g)].map(m => m[0])
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).toContain('value=""')
    expect(inputs[0]).toContain('placeholder="∞"')
    expect(inputs[1]).toContain('value="1"')
    for (const input of inputs) {
      expect(input).toContain('min="0"')
      expect(input).toContain('max="3"')
    }
    expect(html).toContain('Planet 1')
    expect(html).toContain('Planet 2')
  })

  it('checks planets only for a use the player cannot change', () => {
    expect(hasFixedSingleUse(registered('FIRE_TEAM'), [])).toBe(true)
    // Morale Boost's uses are set in its header, even when set to one.
    expect(hasFixedSingleUse(registered('MORALE_BOOST'), [])).toBe(false)
    const configured = ability({ params: { isEnabled: true, uses: 1 } })
    expect(hasFixedSingleUse(configured, [])).toBe(true)
    expect(
      hasFixedSingleUse(configured, [
        { key: 'uses', type: 'number', label: 'Uses' },
      ]),
    ).toBe(false)
  })

  it('counts editable uses even at one', () => {
    const html = renderToStaticMarkup(
      <PlanetUses
        planets={setup.stateData.surfaces.filter(s => s.type === 'PLANET')}
        uses={1}
        singleUse={false}
        value={[]}
        onChange={() => {}}
      />,
    )

    const inputs = [...html.matchAll(/<input[^>]*>/g)].map(m => m[0])
    expect(inputs).toHaveLength(2)
    expect(inputs.every(input => input.includes('type="number"'))).toBe(true)
  })

  it('titles the checkboxes by planet and the counts by uses', () => {
    expect(planetUsesTitle(true)).toBe('Use on planets')
    expect(planetUsesTitle(false)).toBe('Uses per planet')
  })

  it('allows a single use per planet with a checkbox', () => {
    const html = renderToStaticMarkup(
      <PlanetUses
        planets={setup.stateData.surfaces.filter(s => s.type === 'PLANET')}
        uses={1}
        singleUse
        value={[[PLANET_2, 0]]}
        onChange={() => {}}
      />,
    )

    const boxes = [...html.matchAll(/<input[^>]*>/g)].map(m => m[0])
    expect(boxes).toHaveLength(2)
    expect(boxes.every(box => box.includes('type="checkbox"'))).toBe(true)
    expect(boxes[0]).toContain('checked')
    expect(boxes[1]).not.toContain('checked')
  })
})
