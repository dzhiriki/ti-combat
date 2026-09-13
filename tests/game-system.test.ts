import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CombatOutcome } from '@/combat'
import { CombatSetup, type SimulationInput } from '@/hooks/combat-setup'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import {
  getAllAbilities,
  getAvailableAbilities,
} from '@/hooks/combat-setup/get-available-abilities'
import { prepareSimulationConfig } from '@/hooks/combat-setup/prepare-simulation-config'
import {
  buildAbilityLookup,
  validateSerializedConfig,
} from '@/hooks/combat-setup/validation'
import {
  configToSearchString,
  searchParamsToConfig,
} from '@/hooks/use-url-sync'
import { getFaction } from '@/utils/get-faction'
import {
  GAME_SYSTEMS,
  getFactionKeysBySystem,
} from '@/utils/get-faction-system'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { getGameData } from '@/utils/get-game-data'

const abilityLookup = buildAbilityLookup(getAllAbilities())

describe('explicit game system', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(GAME_SYSTEMS)(
    'owns a complete ability slot layout for %s',
    system => {
      const data = getGameData(system)
      const displaySlots = Object.keys(data.SLOT_DISPLAY)

      expect(new Set(data.SLOT_ORDER).size).toBe(data.SLOT_ORDER.length)
      expect(new Set(data.SLOT_ORDER)).toEqual(new Set(displaySlots))

      for (const faction of getFactionKeysBySystem(system)) {
        for (const reg of getAvailableAbilities(system, 'attacker', faction)) {
          expect(
            Object.hasOwn(data.SLOT_DISPLAY, reg.slot),
            `${system}:${faction} uses undeclared slot ${reg.slot}`,
          ).toBe(true)
        }
      }
    },
  )

  it('keeps system-specific slots out of the other system', () => {
    const ti4 = getGameData('TI4')
    const tf = getGameData('TF')

    expect(ti4.SLOT_ORDER).not.toContain('TF_ABILITY')
    expect(tf.SLOT_ORDER).not.toContain('TECHNOLOGY')
    expect(ti4.FACTION_KEY_TO_SLOT.breakthrough).toBe('FACTION_BREAKTHROUGH')
    expect(tf.FACTION_KEY_TO_SLOT.breakthrough).toBeUndefined()
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
    const result = validateSerializedConfig(
      searchParamsToConfig(search, abilityLookup),
      abilityLookup,
    )
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
    getAvailableAbilities('TI4', 'attacker', 'ARBOREC')
    expect(() => getAvailableAbilities('TF', 'attacker', 'ARBOREC')).toThrow(
      'Faction "ARBOREC" is not available in TF',
    )
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
