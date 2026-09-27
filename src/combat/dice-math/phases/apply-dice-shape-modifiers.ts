import type { CombatSide, UnitBaseType } from '@/types'

import type { HitSource, SideStateData } from '../../combat-state/types'
import { parseUnitLocator } from '../../utils/parse-unit-locator'
import { resolveUnitStats } from '../../utils/resolve-unit-stats'
import type {
  AddDiceCountDecl,
  AddDiceGroupDecl,
  ModifierDecl,
  SetDiceCountDecl,
  SideDiceCollection,
} from '../types'

/** Apply dice-shape modifiers (SET_DICE_COUNT / ADD_DICE_COUNT /
 *  ADD_DICE_GROUP) in push order to a side's collection, mutating in place.
 *  Mirrors the previous eager-mutation behavior of the corresponding
 *  SideApi methods (`setDiceCount`, `addDiceCount`, `addDiceGroup`).
 *
 *  `isSelfTarget` is set when the firing side is shooting itself (Proxima
 *  self-bombardment). In that case ADD_DICE_COUNT is skipped: the modifier's
 *  intent is opponent-facing ("give me +1 die to hit you"), so on a
 *  self-targeted roll the bonus would self-inflict damage. Mirrors
 *  `flipRerollSpecsForSelfTarget` — abilities stay naive, the engine
 *  handles the self-target inversion. */
export function applyDiceShapeModifiers(
  collection: SideDiceCollection,
  modifiers: readonly ModifierDecl[],
  side: CombatSide,
  unitStats: SideStateData['unitStats'],
  hitSource: HitSource,
  isSelfTarget: boolean,
): void {
  for (const mod of modifiers) {
    if (mod.side !== side) continue
    switch (mod.type) {
      case 'SET_DICE_COUNT':
        applySetDiceCount(collection, mod, unitStats, hitSource)
        break
      case 'ADD_DICE_COUNT':
        if (isSelfTarget) break
        applyAddDiceCount(collection, mod)
        break
      case 'ADD_DICE_GROUP':
        applyAddDiceGroup(collection, mod)
        break
      default:
        // Other modifier kinds are handled elsewhere in the kernel.
        break
    }
  }
}

function applySetDiceCount(
  collection: SideDiceCollection,
  mod: SetDiceCountDecl,
  unitStats: SideStateData['unitStats'],
  hitSource: HitSource,
): void {
  const baseType = parseUnitLocator(mod.unitType).baseType as UnitBaseType
  const entries = collection[baseType]
  if (!entries) return
  const stats = resolveUnitStats(unitStats, mod.unitType)
  const dieData =
    hitSource === 'COMBAT' ? stats?.COMBAT : stats?.UNIT_ABILITIES?.[hitSource]
  const naturalBase = dieData?.[1] ?? 0
  const next: [number, number, number][] = []
  for (const [unitCount, hv, dpu] of entries) {
    const bonusDice = dpu - naturalBase
    const newDpu = Math.max(0, mod.count + bonusDice)
    const merge = next.find(e => e[1] === hv && e[2] === newDpu)
    if (merge) merge[0] += unitCount
    else next.push([unitCount, hv, newDpu])
  }
  collection[baseType] = next
}

function applyAddDiceCount(
  collection: SideDiceCollection,
  mod: AddDiceCountDecl,
): void {
  const isBest = mod.target === 'BEST'
  const allowed = mod.unitTypes && new Set<string>(mod.unitTypes)
  let bestVariant: UnitBaseType | undefined
  let bestEntry: [number, number, number] | undefined
  let bestHitValue = isBest ? Infinity : -Infinity
  for (const variant of Object.keys(collection) as UnitBaseType[]) {
    if (allowed && !allowed.has(variant)) continue
    const entries = collection[variant]
    if (!entries || entries.length === 0) continue
    for (const entry of entries) {
      const hv = entry[1]
      const better = isBest ? hv < bestHitValue : hv > bestHitValue
      if (better) {
        bestHitValue = hv
        bestVariant = variant
        bestEntry = entry
      }
    }
  }
  if (bestVariant === undefined || bestEntry === undefined) return
  const list = collection[bestVariant]
  if (!list) return
  const [, hv, dpu] = bestEntry
  const newDpu = Math.max(0, dpu + mod.count)
  if (bestEntry[0] > 1) bestEntry[0] -= 1
  else list.splice(list.indexOf(bestEntry), 1)
  const merge = list.find(e => e[1] === hv && e[2] === newDpu)
  if (merge) merge[0] += 1
  else list.push([1, hv, newDpu])
  if (list.length === 0) delete collection[bestVariant]
}

function applyAddDiceGroup(
  collection: SideDiceCollection,
  mod: AddDiceGroupDecl,
): void {
  if (mod.dpu <= 0) return
  const variant = mod.abilityKey as UnitBaseType
  const list = collection[variant] ?? (collection[variant] = [])
  const existing = list.find(e => e[1] === mod.hitValue && e[2] === mod.dpu)
  if (existing) existing[0] += 1
  else list.push([1, mod.hitValue, mod.dpu])
}
