import { CombatEngine, type SurvivorSide } from '@/combat'
import type { CombatMode } from '@/combat/combat-state/types'
import { UNIT_SHORT_NAMES, UNIT_TYPES } from '@/constants/units'
import {
  buildCombatState,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'
import type { UnitBaseType } from '@/types'

const SHORT_TO_BASE: Record<string, UnitBaseType> = Object.fromEntries(
  (Object.entries(UNIT_SHORT_NAMES) as [UnitBaseType, string][]).map(
    ([base, short]) => [short, base],
  ),
)

const BASE_PRIORITY: Record<UnitBaseType, number> = Object.fromEntries(
  UNIT_TYPES.map((t, i) => [t, i]),
) as Record<UnitBaseType, number>

function parseUnits(input: string): SideConfig['units'] {
  const units: SideConfig['units'] = {}
  for (const raw of input.split(',')) {
    const token = raw.trim()
    if (!token) continue
    const match = /^(\d*)([A-Za-z]+)$/.exec(token)
    if (!match) throw new Error(`Invalid unit token: "${token}"`)
    const count = match[1] ? parseInt(match[1], 10) : 1
    const baseType = SHORT_TO_BASE[match[2]]
    if (!baseType) throw new Error(`Unknown unit short name: "${match[2]}"`)
    units[baseType] = (units[baseType] ?? 0) + count
  }
  return units
}

function formatSide(side: SurvivorSide): string {
  const entries = Object.entries(side).filter(
    ([, units]) => units && units.length > 0,
  )
  entries.sort(([a], [b]) => {
    const aBase = a.split(':')[0] as UnitBaseType
    const bBase = b.split(':')[0] as UnitBaseType
    return (BASE_PRIORITY[aBase] ?? 999) - (BASE_PRIORITY[bBase] ?? 999)
  })

  const parts: string[] = []
  for (const [unitType, units] of entries) {
    if (!units) continue
    const baseType = unitType.split(':')[0] as UnitBaseType
    const name = UNIT_SHORT_NAMES[baseType] ?? unitType

    const groups = new Map<string, { healthy: number; damaged: number }>()
    for (const u of units) {
      const key = u.subtypes?.join(',') ?? ''
      const g = groups.get(key) ?? { healthy: 0, damaged: 0 }
      if (u.isDamaged) g.damaged++
      else g.healthy++
      groups.set(key, g)
    }

    for (const [subtypeKey, { healthy, damaged }] of groups) {
      const label = subtypeKey ? `${name}:${subtypeKey}` : name
      if (healthy > 0) {
        parts.push(healthy > 1 ? `${healthy}${label}` : label)
      }
      if (damaged > 0) {
        const dmgLabel = `${label}-`
        parts.push(damaged > 1 ? `${damaged}${dmgLabel}` : dmgLabel)
      }
    }
  }

  return parts.join(', ')
}

const PROBABILITY_DECIMALS = 12
const PROBABILITY_FACTOR = 10 ** PROBABILITY_DECIMALS

interface FormattedOutcome {
  attacker: string
  defender: string
  winner: 'attacker' | 'defender' | 'draw'
  probability: number
}

/** Shorthand SideConfig for snapshot tests. `units` is a comma-separated
 *  short-name list (e.g. `"Fl, 2D, 2PDS"`); other fields mirror combatTest's
 *  `SideConfig`. */
export interface ScenarioSideConfig {
  units: string
  faction?: string
  abilities?: SideConfig['abilities']
}

export interface ScenarioConfig {
  mode: CombatMode
  attacker: ScenarioSideConfig
  defender: ScenarioSideConfig
}

function resolveSide(config: ScenarioSideConfig): SideConfig {
  return {
    faction: config.faction ?? 'ARBOREC',
    units: parseUnits(config.units),
    abilities: config.abilities,
  }
}

export function runScenario(config: ScenarioConfig): FormattedOutcome[] {
  const state = buildCombatState({
    system: 'TI4',
    mode: config.mode,
    attacker: resolveSide(config.attacker),
    defender: resolveSide(config.defender),
  })
  const engine = new CombatEngine()
  return engine
    .simulate(state)
    .map(o => ({
      attacker: formatSide(o.attacker),
      defender: formatSide(o.defender),
      winner: o.winner,
      probability:
        Math.round(o.probability * PROBABILITY_FACTOR) / PROBABILITY_FACTOR,
    }))
    .sort((a, b) => {
      if (a.probability !== b.probability) return a.probability - b.probability
      if (a.attacker !== b.attacker) return a.attacker < b.attacker ? -1 : 1
      if (a.defender !== b.defender) return a.defender < b.defender ? -1 : 1
      return a.winner < b.winner ? -1 : a.winner > b.winner ? 1 : 0
    })
}
