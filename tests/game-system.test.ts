import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CombatOutcome } from '@/combat'
import { CombatSetup, type SimulationInput } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import { prepareSimulationConfig } from '@/hooks/combat-setup/prepare-simulation-config'
import { validateSerializedConfig } from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'
import type { GameSystem } from '@/types'
import { getFaction } from '@/utils/get-faction'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { GAME_SYSTEMS, getGameData } from '@/utils/get-game-data'

describe('explicit game system', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(GAME_SYSTEMS)(
    'lists every available ability exactly once in %s',
    system => {
      const data = getGameData(system)

      for (const faction of Object.keys(data.factions)) {
        const seen = new Set<string>()
        for (const reg of data.getAvailableAbilities('attacker', faction)) {
          const where = `${reg.display.category}/${reg.display.subcategory ?? ''}`
          expect(
            typeof reg.display.order,
            `${system}:${faction} has no render order for ${reg.slot}`,
          ).toBe('number')
          // The engine consumes this list as is — a repeated key would fire
          // its invokes twice.
          expect(
            seen.has(reg.ability.key),
            `${system}:${faction} lists ${reg.ability.key} twice (in ${where})`,
          ).toBe(false)
          seen.add(reg.ability.key)
        }
      }
    },
  )

  it('keeps system-specific slots out of the other system', () => {
    const slotsOf = (system: GameSystem): Set<string> => {
      const data = getGameData(system)
      return new Set(
        Object.keys(data.factions).flatMap(faction =>
          data.getAvailableAbilities('attacker', faction).map(reg => reg.slot),
        ),
      )
    }
    const ti4 = slotsOf('TI4')
    const tf = slotsOf('TF')

    expect(ti4.has('TF_ABILITY')).toBe(false)
    expect(tf.has('TECHNOLOGY')).toBe(false)
    expect(ti4.has('FACTION_BREAKTHROUGH')).toBe(true)
    expect(tf.has('FACTION_BREAKTHROUGH')).toBe(false)
  })

  it('splits a faction card between its own section and the shared pool', () => {
    const data = getGameData('TI4')
    const where = (faction: string, key: string): string[] =>
      data
        .getAvailableAbilities('attacker', faction)
        .filter(reg => reg.ability.key === key)
        .map(reg => `${reg.slot}:${reg.display.category}`)

    // Sardakk's own commander sits under FACTION; for anyone else it is one
    // of the commanders in the shared COMMANDER list — never both.
    expect(where('SARDAKK_NORR', 'GHOM_SEKKUS')).toEqual([
      'FACTION_COMMANDER:FACTION',
    ])
    expect(where('ARBOREC', 'GHOM_SEKKUS')).toEqual([
      'FACTION_COMMANDER:COMMANDER',
    ])
  })

  it.each(GAME_SYSTEMS)('round-trips Neutral vs Neutral in %s', system => {
    const setup = new CombatSetup()
    setup.setSystem(system)
    setup.setFaction('attacker', 'NEUTRAL')
    setup.setFaction('defender', 'NEUTRAL')
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('defender', 'CRUISER', 1)
    if (system === 'TF') {
      setup.setAbilityParam('attacker', 'TF_MIRROR_GENOME', {
        isEnabled: true,
        uses: 1,
      })
    }

    const serialized = setup.toSerializedConfig()
    expect(serialized.g).toBe(system)
    const search = configToSearchString(serialized)
    const searchParams = new URLSearchParams(search)
    expect(searchParams.get('g')).toBe(system)
    expect(searchParams.has('system')).toBe(false)
    const result = validateSerializedConfig(searchParamsToConfig(search))
    expect(result.warnings).toEqual([])
    expect(result.config).toEqual(serialized)

    const restored = new CombatSetup()
    restored.loadConfig(result.config)
    expect(restored.system).toBe(system)
    expect(restored.attackerFaction).toBe('NEUTRAL')
    expect(restored.defenderFaction).toBe('NEUTRAL')
    expect(restored.toSimulationInput()?.system).toBe(system)

    const hasGenome = system === 'TF'
    expect('TF_MIRROR_GENOME' in restored.abilities.attacker).toBe(hasGenome)
    expect('PRE_GALVANIZED' in restored.abilities.attacker).toBe(!hasGenome)
    if (hasGenome) {
      expect(restored.abilities.attacker.TF_MIRROR_GENOME.isEnabled).toBe(true)
    }

    restored.swap()
    expect(restored.toSimulationInput()?.system).toBe(system)
  })

  it('rejects cross-system faction selections without mutating setup', () => {
    const setup = new CombatSetup()
    const before = setup.toSerializedConfig()
    expect(() => setup.setFaction('attacker', 'AVARICE_REX')).toThrow(
      'Faction "AVARICE_REX" is not available in TI4',
    )
    expect(setup.toSerializedConfig()).toEqual(before)

    expect(() => setup.loadConfig({ ...before, df: 'AVARICE_REX' })).toThrow(
      'Faction "AVARICE_REX" is not available in TI4',
    )
    expect(setup.toSerializedConfig()).toEqual(before)
  })

  it('validates factions against the selected system in data lookups', () => {
    // Populate TI4 caches first: a cache keyed only by faction must not let
    // a later cross-system request bypass validation.
    getGameData('TI4').getAvailableAbilities('attacker', 'ARBOREC')
    expect(() =>
      getGameData('TF').getAvailableAbilities('attacker', 'ARBOREC'),
    ).toThrow('Faction "ARBOREC" is not available in TF')
    expect(() => getFaction('TI4', 'AVARICE_REX')).toThrow()
    expect(() => getFactionUnitConfig('TI4', 'AVARICE_REX')).toThrow()
  })

  it('rejects mixed-system simulation input before modifying params', () => {
    const abilities = { attacker: {}, defender: {} }
    expect(() =>
      prepareSimulationConfig(
        'TI4',
        abilities,
        'ARBOREC',
        'AVARICE_REX',
        'SPACE',
      ),
    ).toThrow('Faction "AVARICE_REX" is not available in TI4')
    expect(abilities).toEqual({ attacker: {}, defender: {} })
  })

  it('prepares the requested system for all-neutral combat states', () => {
    const state = buildCombatState({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
    })
    expect(state.data.attacker.abilities.TF_MIRROR_GENOME).toBeDefined()
    expect(state.data.attacker.abilities.PRE_GALVANIZED).toBeUndefined()
  })

  it('uses TF genomes in the worker when both factions are Neutral', async () => {
    const setup = new CombatSetup()
    setup.setSystem('TF')
    setup.setFaction('attacker', 'NEUTRAL')
    setup.setFaction('defender', 'NEUTRAL')
    setup.setUnitCount('attacker', 'CRUISER', 1)
    setup.setUnitCount('defender', 'CRUISER', 1)
    setup.setUnitCount('defender', 'PDS', 1)
    setup.setAbilityParam('attacker', 'TF_MIRROR_GENOME', {
      isEnabled: true,
      uses: 1,
    })
    const input = setup.toSimulationInput()!
    expect(input.system).toBe('TF')

    const worker = {
      onmessage: undefined as
        | ((event: MessageEvent<SimulationInput>) => void)
        | undefined,
      postMessage: vi.fn<(outcomes: CombatOutcome[]) => void>(),
    }
    vi.stubGlobal('self', worker)
    await import('@/combat/combat.worker')
    // Match the worker boundary: prepare mutates its own cloned params.
    worker.onmessage!({
      data: structuredClone(input),
    } as MessageEvent<SimulationInput>)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    const outcomes = worker.postMessage.mock.calls[0][0]
    const attackerWin = outcomes
      .filter(o => o.winner === 'attacker')
      .reduce((sum, o) => sum + o.probability, 0)
    // Mirror Genome blocks the PDS: equal 6-value cruisers give each side
    // 1/3 to win and 1/3 to draw. Losing the TF deck would let the PDS fire.
    expect(attackerWin).toBeCloseTo(1 / 3, 10)
  })
})
