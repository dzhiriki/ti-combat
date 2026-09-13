import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType, UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  isActive: boolean
  availableShips: UnitList<number, UnitBaseType>
}

declare global {
  interface AbilityConfigMap {
    SLEEPER_CELL: Params
  }
}

const SHIP_LIMITS_DEFAULT: UnitList<number, UnitBaseType> = [
  ['FLAGSHIP', UNIT_LIMITS.FLAGSHIP],
  ['WAR_SUN', UNIT_LIMITS.WAR_SUN],
  ['DREADNOUGHT', UNIT_LIMITS.DREADNOUGHT],
  ['CARRIER', UNIT_LIMITS.CARRIER],
  ['CRUISER', UNIT_LIMITS.CRUISER],
  ['DESTROYER', UNIT_LIMITS.DESTROYER],
  ['FIGHTER', UNIT_LIMITS.FIGHTER],
]

export const sleeperCell: Ability<Params> = {
  key: 'SLEEPER_CELL',
  name: 'Sleeper Cell',
  description:
    "At the start of a space combat that you are participating in: You may purge this card; if you do, for each other player's ship that is destroyed during this combat, place 1 ship of that type from your reinforcements in the active system.",
  context: 'SPACE',
  paramsSchema: z.object({
    isActive: z.boolean(),
    availableShips: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    isActive: false,
    availableShips: declareParam<UnitList<number, UnitBaseType>>({
      default: SHIP_LIMITS_DEFAULT,
      source: 'ships',
      sort: 'worth-desc',
      defaultItemValue: 0,
      filter: { combatMode: 'SPACE', includeOnlyBaseTypes: true },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'availableShips',
      label: 'Available Ships',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('availableShips'),
    },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ isActive: true })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (params, ctx, ids) => {
        if (!params.isActive) return false
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)
        for (const id of ids) {
          const variantKey =
            ctx.api.own.getUnitVariantKey(id) ??
            ctx.api.opponent.getUnitVariantKey(id)
          if (!variantKey) continue
          const { type } = parseVariantId(variantKey)
          if (shipsSet.has(type)) return true
        }
        return false
      },
      call: (ctx, params, ids) => {
        const { ships } = ctx.api.own.getAbilityConfig('SETTINGS')
        const shipsSet = new Set<UnitBaseType>(ships)

        const opponentDestroyed: Partial<Record<UnitBaseType, number>> = {}
        const ownDestroyed: Partial<Record<UnitBaseType, number>> = {}

        for (const id of ids) {
          const ownKey = ctx.api.own.getUnitVariantKey(id)
          if (ownKey) {
            const { type } = parseVariantId(ownKey)
            if (!shipsSet.has(type)) continue
            ownDestroyed[type] = (ownDestroyed[type] ?? 0) + 1
            continue
          }
          const oppKey = ctx.api.opponent.getUnitVariantKey(id)
          if (oppKey) {
            const { type } = parseVariantId(oppKey)
            if (!shipsSet.has(type)) continue
            opponentDestroyed[type] = (opponentDestroyed[type] ?? 0) + 1
          }
        }

        const availableMap = new Map<UnitBaseType, number>(
          params.availableShips,
        )

        // Refund first: own destroyed ships return to reinforcements.
        for (const [type, count] of Object.entries(ownDestroyed)) {
          const baseType = type as UnitBaseType
          const current = availableMap.get(baseType) ?? 0
          availableMap.set(
            baseType,
            Math.min(UNIT_LIMITS[baseType], current + count),
          )
        }

        // Place: capped by reinforcements available AND on-board UNIT_LIMITS.
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of Object.entries(opponentDestroyed)) {
          const baseType = type as UnitBaseType
          const available = availableMap.get(baseType) ?? 0
          if (available <= 0) continue
          const existing = ctx.api.own.countUnits(baseType, {
            includeVariants: true,
          })
          const onBoardCanPlace = Math.max(0, UNIT_LIMITS[baseType] - existing)
          const placeCount = Math.min(count, available, onBoardCanPlace)
          if (placeCount > 0) {
            toPlace[baseType] = placeCount
            availableMap.set(baseType, available - placeCount)
          }
        }

        if (Object.keys(toPlace).length > 0) {
          ctx.api.own.placeUnits(toPlace)
        }

        const availabilityChanged =
          Object.keys(ownDestroyed).length > 0 ||
          Object.keys(toPlace).length > 0
        if (availabilityChanged) {
          ctx.api.own.updateAbilityConfig({
            availableShips: Array.from(availableMap.entries()) as UnitList<
              number,
              UnitBaseType
            >,
          })
        }
      },
    },
  ],
}
