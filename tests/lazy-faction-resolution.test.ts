import { describe, expect, it, vi } from 'vitest'

import type { Ability, RegisteredAbility } from '@/combat'
import { createGameData } from '@/data/create-game-data'
import { SLOTS } from '@/data/main/ability-slots'
import { nekro_virus } from '@/data/main/faction/nekro_virus'
import type { FactionDefinition, LazyContext } from '@/types'

const ability = (key: string): Ability => ({
  key,
  name: key,
  headerUI: 'isEnabled',
  params: { isEnabled: false, uses: 1 },
  invoke: [],
})

function createData(
  factions: Readonly<Record<string, FactionDefinition>>,
  abilities: Readonly<Record<string, readonly Ability[]>> = {},
) {
  return createGameData({
    id: 'TI4',
    label: 'Test',
    factions,
    units: {},
    abilities,
    slots: SLOTS,
  })
}

describe('recursive faction lookups', () => {
  it.each([{ order: ['A', 'B', 'C', 'D'] }, { order: ['D', 'C', 'B', 'A'] }])(
    'resolves chains and shared dependencies in $order order',
    ({ order }) => {
      const leaf = ability('LEAF')
      const initD = vi.fn(() => ({ agent: [leaf] }))
      const initB = vi.fn(
        (context: LazyContext) => context.getFaction('D').abilities!,
      )
      const initC = vi.fn(
        (context: LazyContext) => context.getFaction('D').abilities!,
      )
      const initFlagship = vi.fn(
        (context: LazyContext) => context.getFaction('B').abilities!.agent,
      )
      const initA = vi.fn(
        (context: LazyContext) => context.getFaction('C').abilities!,
      )
      const definitions: Record<string, FactionDefinition> = {
        A: {
          name: 'A',
          units: { FLAGSHIP: { BASE: { ABILITIES: initFlagship } } },
          abilities: initA,
        },
        B: { name: 'B', units: {}, abilities: initB },
        C: { name: 'C', units: {}, abilities: initC },
        D: { name: 'D', units: {}, abilities: initD },
      }
      const data = createData(
        Object.fromEntries(order.map(key => [key, definitions[key]])),
      )

      expect(data.getFaction('A').units.FLAGSHIP!.BASE.ABILITIES).toEqual([
        leaf,
      ])
      for (const key of order) {
        expect(data.getFaction(key).abilities).toBe(data.factions.D.abilities)
      }
      for (const initialize of [initA, initB, initC, initD, initFlagship]) {
        expect(initialize).toHaveBeenCalledTimes(1)
      }
      expect(Object.keys(data.factions)).toEqual(order)
      expect(data.allAbilities).toMatchObject([
        { key: 'LEAF', factionKey: order[0] },
      ])
    },
  )

  it('reconciles faction abilities while its own flagship is initializing', () => {
    const tech = ability('TECH')
    const initAbilities = vi.fn(() => ({ technology: [tech] }))
    const initFlagship = vi.fn(
      (context: LazyContext) =>
        context.getFaction('SELF').abilities!.technology,
    )
    const data = createData({
      SELF: {
        name: 'Self',
        units: { FLAGSHIP: { BASE: { ABILITIES: initFlagship } } },
        abilities: initAbilities,
      },
    })

    expect(data.getFaction('SELF').units.FLAGSHIP!.BASE.ABILITIES).toEqual([
      tech,
    ])
    expect(initFlagship).toHaveBeenCalledTimes(1)
    expect(initAbilities).toHaveBeenCalledTimes(1)
  })

  it('reconciles units when a slot starts the same faction’s ability initializer first', () => {
    const native = ability('NATIVE')
    const upgraded = ability('UPGRADED')
    const initBase = vi.fn(() => [native])
    const initUpgraded = vi.fn(() => [upgraded])
    const initAbilities = vi.fn((context: LazyContext) => {
      const flagship = context.getFaction('SOURCE').units.FLAGSHIP!
      return {
        technology: [
          ...flagship.BASE.ABILITIES!,
          ...flagship.UPGRADED!.ABILITIES!,
        ],
      }
    })
    const data = createData({
      READER: {
        name: 'Reader',
        units: {},
        abilities: context => ({
          technology: [...context.getAbilities('FACTION_TECHNOLOGY')],
        }),
      },
      SOURCE: {
        name: 'Source',
        units: {
          FLAGSHIP: {
            BASE: { ABILITIES: initBase },
            UPGRADED: { ABILITIES: initUpgraded },
          },
        },
        abilities: initAbilities,
      },
    })

    expect(data.factions.SOURCE.abilities!.technology).toEqual([
      native,
      upgraded,
    ])
    expect(
      data.factions.READER.abilities!.technology.map(entry => entry.key),
    ).toEqual(['NATIVE', 'UPGRADED'])
    for (const initialize of [initBase, initUpgraded, initAbilities]) {
      expect(initialize).toHaveBeenCalledTimes(1)
    }
  })

  it.each(['BASE', 'UPGRADED'] as const)(
    'allows %s to depend on the other variant',
    dependent => {
      const source = dependent === 'BASE' ? 'UPGRADED' : 'BASE'
      const native = ability('VARIANT')
      const initialize = vi.fn(
        (context: LazyContext) =>
          context.getFaction('SELF').units.FLAGSHIP![source]!.ABILITIES!,
      )
      const initializeSource = vi.fn(() => [native])
      const data = createData({
        SELF: {
          name: 'Self',
          units: {
            FLAGSHIP: {
              BASE: {
                ABILITIES: dependent === 'BASE' ? initialize : initializeSource,
              },
              UPGRADED: {
                ABILITIES:
                  dependent === 'UPGRADED' ? initialize : initializeSource,
              },
            },
          },
        },
      })

      expect(data.factions.SELF.units.FLAGSHIP![dependent]!.ABILITIES).toEqual([
        native,
      ])
      expect(initialize).toHaveBeenCalledTimes(1)
      expect(initializeSource).toHaveBeenCalledTimes(1)
    },
  )

  it('creates fresh contexts and resolves each field separately without changing definitions', () => {
    const initialize = vi.fn((context: LazyContext) => [
      ...context.getAbilities('TECHNOLOGY'),
    ])
    const agents = [ability('STATIC')]
    const base = Object.freeze({ ABILITIES: initialize })
    const upgraded = Object.freeze({ ABILITIES: initialize })
    const definition: FactionDefinition = Object.freeze({
      name: 'Reusable',
      units: Object.freeze({
        FLAGSHIP: Object.freeze({ BASE: base, UPGRADED: upgraded }),
      }),
      abilities: Object.freeze({ agent: agents }),
    })
    const definitions = Object.freeze({ REUSABLE: definition })
    const first = createData(definitions, { TECHNOLOGY: [ability('FIRST')] })
    const second = createData(definitions, { TECHNOLOGY: [ability('SECOND')] })

    expect(initialize).toHaveBeenCalledTimes(4)
    const contexts = initialize.mock.calls.map(([context]) => context)
    expect(contexts[0]).toBe(contexts[1])
    expect(contexts[2]).toBe(contexts[3])
    expect(contexts[0]).not.toBe(contexts[2])
    expect(base.ABILITIES).toBe(initialize)
    expect(upgraded.ABILITIES).toBe(initialize)
    expect(first.factions.REUSABLE.abilities!.agent).toBe(agents)
    expect(second.factions.REUSABLE.abilities!.agent).toBe(agents)
    for (const [data, key] of [
      [first, 'FIRST'],
      [second, 'SECOND'],
    ] as const) {
      const unit = data.factions.REUSABLE.units.FLAGSHIP!
      expect(unit.BASE.ABILITIES).toMatchObject([{ key }])
      expect(unit.UPGRADED!.ABILITIES).toMatchObject([{ key }])
      expect(
        Object.getOwnPropertyDescriptor(unit.BASE, 'ABILITIES')!.get,
      ).toBeUndefined()
    }
  })

  it('propagates initializer failures and rejects unknown factions', () => {
    const failure = new Error('Initialization failed')
    expect(() =>
      createData({
        BROKEN: {
          name: 'Broken',
          units: {},
          abilities: () => {
            throw failure
          },
        },
      }),
    ).toThrow(failure)
    expect(() =>
      createData({
        BROKEN: {
          name: 'Broken',
          units: {},
          abilities: context => context.getFaction('MISSING').abilities!,
        },
      }),
    ).toThrow('Faction "MISSING" is not available')
  })
})

describe('recursive slot lookups', () => {
  it('resolves only the requested contributors and preserves registration rules', () => {
    const shared = ability('SHARED')
    const group = ability('GROUP')
    const base = ability('BASE')
    const upgraded = ability('UPGRADED')
    const baseDeploy = ability('BASE_DEPLOY')
    const upgradedDeploy = ability('UPGRADED_DEPLOY')
    const hidden: Ability = { ...ability('HIDDEN'), headerUI: undefined }
    const initAbilities = vi.fn(() => ({
      agent: [ability('AGENT')],
      cruiser: [group],
    }))
    const initBase = vi.fn(() => [base, shared, hidden])
    const initUpgraded = vi.fn(() => [base, upgraded])
    const initMech = vi.fn(() => [ability('MECH')])
    let seen: readonly RegisteredAbility[] = []
    let capturedContext: LazyContext | undefined
    const data = createData(
      {
        READER: {
          name: 'Reader',
          units: {
            FLAGSHIP: {
              BASE: {
                ABILITIES: context => {
                  capturedContext = context
                  expect(context.getAbilities('GENERAL')).toMatchObject([
                    { key: 'SHARED', slot: 'GENERAL' },
                  ])
                  expect(context.getAbilities('FACTION_UNKNOWN')).toEqual([])
                  expect(context.getAbilities('FACTION_AGENT')).toMatchObject([
                    {
                      key: 'AGENT',
                      slot: 'FACTION_AGENT',
                      factionKey: 'SOURCE',
                    },
                  ])
                  expect(initBase).not.toHaveBeenCalled()
                  seen = context.getAbilities('FACTION_CRUISER')
                  expect(initMech).not.toHaveBeenCalled()
                  return []
                },
              },
            },
          },
        },
        SOURCE: {
          name: 'Source',
          abilities: initAbilities,
          units: {
            CRUISER: {
              BASE: {
                ABILITIES: initBase,
                UNIT_ABILITIES: { DEPLOY: baseDeploy },
              },
              UPGRADED: {
                ABILITIES: initUpgraded,
                UNIT_ABILITIES: { DEPLOY: upgradedDeploy },
              },
            },
            MECH: { BASE: { ABILITIES: initMech } },
          },
        },
      },
      { GENERAL: [shared] },
    )

    expect(seen.map(entry => entry.key)).toEqual([
      'GROUP',
      'BASE',
      'UPGRADED',
      'BASE_DEPLOY',
      'UPGRADED_DEPLOY',
    ])
    expect(seen).toEqual(data.getAbilities('FACTION_CRUISER'))
    expect(seen).toMatchObject([
      { factionKey: 'SOURCE', slot: 'FACTION_CRUISER' },
      { factionKey: 'SOURCE', slot: 'FACTION_CRUISER' },
      { factionKey: 'SOURCE', slot: 'FACTION_CRUISER' },
      { deploy: { unitType: 'CRUISER', base: true, upgraded: false } },
      { deploy: { unitType: 'CRUISER', base: false, upgraded: true } },
    ])
    for (const initialize of [
      initAbilities,
      initBase,
      initUpgraded,
      initMech,
    ]) {
      expect(initialize).toHaveBeenCalledTimes(1)
    }
    const final = capturedContext!.getAbilities('FACTION_CRUISER')
    expect(final[0]).toEqual(
      data.allAbilities.find(entry => entry.key === 'GROUP'),
    )
    expect(data.getAbilities('FACTION_MECH')).toMatchObject([{ key: 'MECH' }])
  })
})

describe('Nekro lazy context', () => {
  it.each([true, false])(
    'copies registered technologies once with Nekro first: %s',
    nekroFirst => {
      const sourceTech = ability('SOURCE_TECH')
      const externalTech: Ability = {
        ...ability('EXTERNAL_TECH'),
        invoke: [{ timing: 'PREPARE', external: true, call: () => {} }],
      }
      const initFlagship = vi.fn(() => [ability('SOURCE_FLAGSHIP')])
      const initSlotFlagship = vi.fn(() => [ability('SLOT_FLAGSHIP')])
      const initCruiser = vi.fn(() => [ability('SOURCE_CRUISER')])
      const initAbilities = vi.fn(() => ({
        technology: [sourceTech, externalTech, sourceTech],
      }))
      const definitions: Record<string, FactionDefinition> = {
        NEKRO_VIRUS: nekro_virus,
        SOURCE: {
          name: 'Source',
          icon: '<svg>Source</svg>',
          abilities: initAbilities,
          units: {
            FLAGSHIP: { BASE: { ABILITIES: initFlagship } },
            CRUISER: { BASE: { ABILITIES: initCruiser } },
          },
        },
        FLAG_SOURCE: {
          name: 'Flag source',
          units: {
            FLAGSHIP: { BASE: { ABILITIES: initSlotFlagship } },
          },
        },
      }
      const roster = nekroFirst
        ? definitions
        : Object.fromEntries(Object.entries(definitions).reverse())
      const first = createData(roster)
      const second = createData(roster)

      for (const data of [first, second]) {
        const nekro = data.getFaction('NEKRO_VIRUS')
        expect(
          nekro.units.FLAGSHIP!.BASE.ABILITIES!.map(entry => entry.key),
        ).toEqual([
          'THE_ALASTOR',
          'SUSTAIN_DAMAGE',
          ...(nekroFirst
            ? ['NEKRO_FLAGSHIP_SOURCE_FLAGSHIP', 'NEKRO_FLAGSHIP_SLOT_FLAGSHIP']
            : [
                'NEKRO_FLAGSHIP_SLOT_FLAGSHIP',
                'NEKRO_FLAGSHIP_SOURCE_FLAGSHIP',
              ]),
        ])
        expect(nekro.abilities!.technology).toMatchObject([
          { key: 'NEKRO_SOURCE_TECH', icon: '<svg>Source</svg>' },
          { key: 'NEKRO_EXTERNAL_TECH', icon: '<svg>Source</svg>' },
        ])
        expect(nekro.abilities!.technology).toHaveLength(2)
        expect(nekro.abilities!.technology[1].invoke).not.toBe(
          externalTech.invoke,
        )
        expect(nekro.abilities!.technology[1].invoke).toEqual(
          externalTech.invoke,
        )
        expect(
          data.getAbilities('FACTION_TECHNOLOGY').map(entry => entry.key),
        ).not.toContain('NEKRO_NEKRO_EXTERNAL_TECH')
        expect(nekro.abilities!.cruiser).toMatchObject([
          { key: 'NEKRO_UNIT_SOURCE_CRUISER' },
        ])
      }
      for (const initialize of [
        initFlagship,
        initSlotFlagship,
        initCruiser,
        initAbilities,
      ]) {
        expect(initialize).toHaveBeenCalledTimes(2)
      }
      expect(first.factions.NEKRO_VIRUS.abilities).not.toBe(
        second.factions.NEKRO_VIRUS.abilities,
      )
      expect(first.factions.NEKRO_VIRUS.abilities!.ability[0]).toBe(
        second.factions.NEKRO_VIRUS.abilities!.ability[0],
      )
      expect(first.factions.NEKRO_VIRUS.abilities!.technology[0]).not.toBe(
        second.factions.NEKRO_VIRUS.abilities!.technology[0],
      )
    },
  )
})
