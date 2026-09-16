import { type Ability, type AbilityReadContext } from '@/combat'
import type { SideApi } from '@/combat/abilities-engine/api/ability-api'
import { STRUCTURES } from '@/constants/units'
import type { DiceGroup, UnitList, UnitType } from '@/types'

export const linkship: Ability = {
  key: 'LINKSHIP',
  name: 'Linkship',
  description:
    'Linkship I: This unit can use the Space Cannon ability of one of your structures in its space area; each structure can only be triggered once.\n\nLinkship II: This unit can use the Space Cannon ability of one of your structures in its space area; each linkship can trigger the same structure.',
  warning:
    'In simplified view, all Ral Nel structures are placed in the space area during space combat. For fine-tuned placement, use full view.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      // Linkship I consumes a structure for this Space Cannon pass. Linkship
      // II can reuse the same structure for every linkship. Reading the
      // source unit's effective stats also handles upgrades gained in combat.
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: (_params, ctx) => {
        const structuresInSpace = getStructuresInSpace(ctx.api.own)
        const available = isLinkshipII(ctx)
          ? structuresInSpace
          : availableStructures(structuresInSpace, getConsumed(ctx.api.own))
        return available.some(([, count]) => count > 0)
      },
      call: ctx => {
        const upgraded = isLinkshipII(ctx)
        const structuresInSpace = getStructuresInSpace(ctx.api.own)
        const structures = upgraded
          ? structuresInSpace
          : availableStructures(structuresInSpace, getConsumed(ctx.api.own))
        const best = findBestSpaceCannon(structures, ctx.api.own)
        if (!best) return

        ctx.api.own.addDiceGroup(best.sc)
        if (upgraded) return

        ctx.api.own.updateRunState({
          consumed: (prev?: UnitList<number>) => {
            const list = prev ?? []
            const next = list.map(([k, v]) =>
              k === best.key ? [k, v + 1] : [k, v],
            ) as UnitList<number>
            if (!list.some(([k]) => k === best.key)) {
              next.push([best.key as UnitType, 1])
            }
            return next
          },
        })
      },
    },
  ],
}

function isLinkshipII(ctx: AbilityReadContext): boolean {
  return ctx.api.own.getUnitStats(ctx.getUnit())?.NAME === 'Linkship II'
}

function expectedHits(sc: DiceGroup): number {
  return (sc[1] + (sc[2] ?? 0)) * (11 - sc[0])
}

function getConsumed(api: SideApi): UnitList<number> {
  return (
    (api.getRunState('LINKSHIP')?.consumed as UnitList<number> | undefined) ??
    []
  )
}

function getStructuresInSpace(api: SideApi): UnitList<number> {
  const counts = new Map<UnitType, number>()
  for (const structure of STRUCTURES) {
    for (const id of api.surface.getUnits(structure, {
      includeVariants: true,
    })) {
      const unitType = api.getUnitVariantKey(id)
      if (!unitType) continue
      counts.set(unitType, (counts.get(unitType) ?? 0) + 1)
    }
  }
  return [...counts]
}

function availableStructures(
  structures: UnitList<number>,
  consumed: UnitList<number>,
): UnitList<number> {
  const consumedMap = new Map<string, number>()
  for (const [k, v] of consumed) consumedMap.set(k, v)
  return structures.map(([k, v]) => [
    k,
    Math.max(0, v - (consumedMap.get(k) ?? 0)),
  ]) as UnitList<number>
}

function findBestSpaceCannon(
  structures: UnitList<number>,
  api: SideApi,
): { key: string; sc: DiceGroup } | null {
  let best: { key: string; sc: DiceGroup } | null = null
  for (const [key, count] of structures) {
    if (count <= 0) continue
    const sc = api.getUnitStats(key as UnitType)?.UNIT_ABILITIES?.SPACE_CANNON
    if (sc && (!best || expectedHits(sc) > expectedHits(best.sc))) {
      best = { key, sc: [...sc] as DiceGroup }
    }
  }
  return best
}
