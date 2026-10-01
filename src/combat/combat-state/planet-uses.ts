import type { CombatSide, SurfaceId } from '@/types'

import { resolveInvokes } from '../abilities-engine/resolve-invokes'
import type {
  Ability,
  AbilityLookupContext,
  AbilityTiming,
} from '../abilities-engine/types'
import { CombatSideState } from '../combat-side-state/combat-side-state'
import type { CombatStateData, PlanetUseLimit } from './types'

/** An ability's per-planet use caps, as stored in its config. A planet
 *  without an entry is not limited. */
export type PlanetUsesParam = readonly (readonly [SurfaceId, number])[]

const SIDES = ['attacker', 'defender'] as const

/** Timings that run once for the whole system, outside any planet's turn
 *  (or only in space combat). */
const SYSTEM_TIMINGS: ReadonlySet<AbilityTiming> = new Set([
  'PREPARE',
  'COMMIT_UNITS',
  'COMMIT_UNITS_STEP',
  'BOMBARDMENT_STEP',
  'SPACE_CANNON_OFFENSE_STEP',
  'AFB_STEP',
])

/** Whether an ability spends its limited uses on a specific planet of an
 *  invasion: one of its use-spending invokes runs during a planet's
 *  bombardment, Space Cannon Defense or ground combat, so its uses can be
 *  capped per planet. Blitz (PREPARE) can't. */
export function spendsUsesOnPlanet(
  ability: Ability,
  params: Record<string, unknown>,
  ctx: AbilityLookupContext,
): boolean {
  if (ability.readOnly || ability.context === 'SPACE') return false
  if (!Number.isFinite(params.uses)) return false
  return resolveInvokes(ability, params, ctx).some(
    invoke => !invoke.system && !SYSTEM_TIMINGS.has(invoke.timing),
  )
}

function currentUses(
  data: CombatStateData,
  side: CombatSide,
  key: string,
): number | undefined {
  const uses = CombatSideState.getLiveParams(data[side], key)?.uses
  return typeof uses === 'number' ? uses : undefined
}

function setUses(
  data: CombatStateData,
  side: CombatSide,
  key: string,
  uses: number,
): void {
  const sideData = data[side]
  sideData.liveAbilities = {
    ...sideData.liveAbilities,
    [key]: { ...sideData.liveAbilities[key], uses },
  }
}

/** The use limits of a multi-planet invasion: one per ability whose config
 *  caps a planet it fights over. Undefined when nothing is capped. */
export function collectPlanetUseLimits(
  data: CombatStateData,
): readonly PlanetUseLimit[] | undefined {
  const planets = data.invasion?.planets
  if (!planets) return undefined
  const limits: PlanetUseLimit[] = []
  for (const side of SIDES) {
    for (const [key, params] of Object.entries(data[side].abilities)) {
      const caps = (params as { planetUses?: PlanetUsesParam }).planetUses
      if (!caps?.length) continue
      if (!Number.isFinite(currentUses(data, side, key))) continue
      const byPlanet = new Map(caps)
      const allowance = planets.map(planet => byPlanet.get(planet) ?? Infinity)
      if (allowance.every(cap => cap === Infinity)) continue
      limits.push({ side, key, allowance, reserved: 0, entered: 0 })
    }
  }
  return limits.length ? limits : undefined
}

/** Start resolving planet `index`: its abilities may spend at most what the
 *  planet has left, and the rest of their uses wait for later planets. */
export function enterPlanetUses(data: CombatStateData, index: number): void {
  const limits = data.planetUses
  if (!limits) return
  data.planetUses = limits.map(limit => {
    const total = currentUses(data, limit.side, limit.key) ?? 0
    const usable = Math.max(0, Math.min(total, limit.allowance[index]))
    if (usable !== total) setUses(data, limit.side, limit.key, usable)
    return { ...limit, reserved: total - usable, entered: usable }
  })
}

/** Stop resolving planet `index`: what its abilities spent comes off the
 *  planet's allowance, and the uses held back return. */
export function leavePlanetUses(data: CombatStateData, index: number): void {
  const limits = data.planetUses
  if (!limits) return
  data.planetUses = limits.map(limit => {
    const uses = currentUses(data, limit.side, limit.key) ?? 0
    const spent = Math.max(0, limit.entered - uses)
    if (limit.reserved)
      setUses(data, limit.side, limit.key, uses + limit.reserved)
    const allowance = limit.allowance.map((left, i) =>
      i === index ? left - spent : left,
    )
    return { ...limit, allowance, reserved: 0, entered: 0 }
  })
}

/** State-hash segment for the use limits; empty when nothing is capped. */
export function planetUsesHash(data: CombatStateData): string {
  const limits = data.planetUses
  if (!limits) return ''
  return `|${limits
    .map(
      limit =>
        `${limit.side[0]}${limit.key}:${limit.reserved}/${limit.entered}/${limit.allowance.join('.')}`,
    )
    .join(',')}`
}
