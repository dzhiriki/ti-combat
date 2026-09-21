import { resolveInvokes } from '@/combat'
import { extractDefaults } from '@/combat/abilities-engine/declare-param'
import type {
  Ability,
  AbilityCallContext,
  AbilityLookupContext,
  AbilityReadContext,
  SelectGroup,
  SelectItem,
} from '@/combat/abilities-engine/types'
import baseUnits from '@/data/main/base-units'
import type { UnitBaseType } from '@/types'

import { createGenericUnitUpgrades } from './generic-unit-upgrades'

const NONE = 'none'

type TSParams = {
  enableAbilityKey: string
  disableAbilityKey: string
  enableMordred: boolean
  disableMordred: boolean
  opponentDestroyed?: boolean
}

interface AbilityGroup {
  group: string
  abilities: readonly Ability[]
}

function getAbilityGroups(
  ctx: AbilityLookupContext,
  action: 'enable' | 'disable',
): AbilityGroup[] {
  const units = ctx.abilities.own.all.filter(ability =>
    ability.key.startsWith('NEKRO_UNIT_'),
  )
  const factionGroups: AbilityGroup[] = [
    {
      group: 'Faction Technology',
      abilities: ctx.abilities.own.get('FACTION_TECHNOLOGY'),
    },
    { group: 'Faction Unit', abilities: units },
  ]
  if (action === 'disable') return factionGroups

  // Generic upgrades are selectable only through Singularity, not registered
  // cards. Their conflicts come from the copies available in this context.
  const conflicts: Partial<Record<UnitBaseType, string[]>> = {}
  for (const ability of units) {
    const type = ability.exclusiveGroup as UnitBaseType | undefined
    if (type) (conflicts[type] ??= []).push(ability.key)
  }
  return [
    { group: 'Technology', abilities: ctx.abilities.own.get('TECHNOLOGY') },
    {
      group: 'Unit Upgrade',
      abilities: createGenericUnitUpgrades(baseUnits, conflicts),
    },
    ...factionGroups,
    {
      group: 'Flagship',
      abilities: ctx.abilities.own
        .get('FACTION_FLAGSHIP')
        .filter(ability => ability.key.startsWith('NEKRO_FLAGSHIP_')),
    },
  ]
}

function findAbility(
  ctx: AbilityLookupContext,
  key: string,
): Ability | undefined {
  for (const group of getAbilityGroups(ctx, 'enable')) {
    const ability = group.abilities.find(ability => ability.key === key)
    if (ability) return ability
  }
}

export const technologicalSingularity: Ability<TSParams> = {
  key: 'TECHNOLOGICAL_SINGULARITY',
  name: 'Technological Singularity',
  description:
    "Once per combat, after 1 of your opponent's units is destroyed, you may gain 1 technology that is owned by that player.",
  params: {
    isEnabled: false,
    uses: Infinity,
    enableAbilityKey: NONE,
    disableAbilityKey: NONE,
    enableMordred: false,
    disableMordred: false,
  },
  headerUI: 'isEnabled',
  declareParamChange: (params, ctx) => {
    if (!params.isEnabled || params.enableAbilityKey === NONE) return []
    const target = findAbility(ctx, params.enableAbilityKey)
    if (!target?.declareParamChange) return []
    const synth = {
      ...extractDefaults(target),
      [target.headerUI ?? 'isEnabled']: true,
    }
    return target.declareParamChange(
      synth as Parameters<NonNullable<typeof target.declareParamChange>>[0],
      { abilities: ctx.abilities, this: target },
    )
  },
  uiConfig: ctx => {
    const disableGroups = buildSelectGroups(
      getAbilityGroups(ctx, 'disable'),
      ctx,
      true,
    )
    const mordredEnabled = !!ctx.api.own.getAbilityConfig(
      'MORDRED' as keyof AbilityConfigMap,
    )?.isEnabled
    return [
      {
        key: 'enableAbilityKey',
        label: 'Enable ability',
        type: 'select',
        items: [
          { label: 'None', value: NONE } satisfies SelectItem,
          ...buildSelectGroups(getAbilityGroups(ctx, 'enable'), ctx, false),
        ],
      },
      ...(disableGroups.length > 0
        ? [
            {
              key: 'disableAbilityKey' as const,
              label: 'Disable ability',
              type: 'select' as const,
              items: [
                { label: 'None', value: NONE } satisfies SelectItem,
                ...disableGroups,
              ],
            },
          ]
        : []),
      mordredEnabled
        ? { key: 'disableMordred', label: 'Disable Mordred', type: 'checkbox' }
        : { key: 'enableMordred', label: 'Enable Mordred', type: 'checkbox' },
    ]
  },
  onParamSet: (currentParams, key, value) => {
    if (
      key === 'enableAbilityKey' &&
      value !== NONE &&
      value === currentParams.disableAbilityKey
    ) {
      return { ...currentParams, disableAbilityKey: NONE }
    }
    if (
      key === 'disableAbilityKey' &&
      value !== NONE &&
      value === currentParams.enableAbilityKey
    ) {
      return { ...currentParams, enableAbilityKey: NONE }
    }
    return currentParams
  },
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      isCallable: (params, ctx, ids) => {
        if (params.opponentDestroyed) return false
        return ids.some(id => !!ctx.api.opponent.getUnitVariantKey(id))
      },
      call: (ctx, params) => {
        ctx.api.own.updateAbilityConfig({ opponentDestroyed: true })

        // Run disables first so their resets do not overwrite newly gained stats.
        if (params.disableAbilityKey !== NONE) {
          const config = ctx.api.own.getAbilityConfig(
            params.disableAbilityKey as keyof AbilityConfigMap,
          ) as { reset?: (ctx: AbilityCallContext) => void } | undefined
          config?.reset?.(ctx)
        }

        if (params.enableAbilityKey !== NONE) {
          const ability = findAbility(ctx, params.enableAbilityKey)
          if (ability) {
            applyPrepare(ability, ctx)
            ctx.api.own.updateAbilityConfig(ability.key, { isEnabled: true })
          }
        }

        if (params.enableMordred) {
          ctx.api.own.updateAbilityConfig('MORDRED', { isEnabled: true })
        }

        if (params.disableMordred) {
          ctx.api.own.updateAbilityConfig('MORDRED', { isEnabled: false })
        }
      },
    },
  ],
}

function applyPrepare(ability: Ability, ctx: AbilityCallContext): void {
  const params = (ctx.api.own.getAbilityConfig(
    ability.key as keyof AbilityConfigMap,
  ) ?? {}) as Record<string, unknown>
  for (const invoke of resolveInvokes(ability, params, ctx)) {
    if (invoke.timing !== 'PREPARE') continue
    invoke.call(ctx, params)
  }
}

function buildSelectGroups(
  groups: AbilityGroup[],
  ctx: AbilityReadContext,
  enabled: boolean,
): SelectGroup[] {
  return groups.flatMap(({ group, abilities }) => {
    const items = abilities
      .filter(ability => {
        const config = ctx.api.own.getAbilityConfig(
          ability.key as keyof AbilityConfigMap,
        )
        return !!config?.isEnabled === enabled
      })
      .map(ability => ({ label: ability.name, value: ability.key }))
    return items.length > 0 ? [{ group, items }] : []
  })
}
