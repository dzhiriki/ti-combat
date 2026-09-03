import { describe, expect, it } from 'vitest'

import {
  type Ability,
  type AbilityReadContext,
  extractDefaults,
} from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import * as main from '@/data/main'
import * as tf from '@/data/tf'
import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import type { FactionKey, GameSystem } from '@/types'
import { getFactionKeysBySystem } from '@/utils/get-faction-system'

// Static invariants over every registered ability. Each check here enforces a
// rule that previously lived only in docs/engine-gotchas.md or the ability
// dev-guide checklist — violations render wrong or silently misfire at
// runtime, so they belong in CI, not in reviewers' memories.

/** Every ability object reachable by the engine, labeled for error messages.
 *  Deduped by object reference — the same ability registered under several
 *  slots (agents, shared unit abilities) is one entry. */
function collectAllAbilities(): Map<Ability, string> {
  const out = new Map<Ability, string>()
  for (const a of getAllAbilities()) {
    if (!out.has(a)) out.set(a, a.key)
  }
  // getAllAbilities skips unit-attached abilities with no UI — walk the unit
  // definitions too so engine-level checks cover them.
  for (const [factionKey, faction] of [
    ...Object.entries(main.factions),
    ...Object.entries(tf.factions),
  ]) {
    for (const unitDef of Object.values(faction.units)) {
      if (!unitDef) continue
      for (const stats of [unitDef.BASE, unitDef.UPGRADED]) {
        if (!stats) continue
        for (const a of stats.ABILITIES ?? []) {
          if (!out.has(a)) out.set(a, `${factionKey} ${a.key}`)
        }
        const deploy = stats.UNIT_ABILITIES?.DEPLOY
        if (deploy && !out.has(deploy)) {
          out.set(deploy, `${factionKey} ${deploy.key}`)
        }
      }
    }
  }
  return out
}

describe('engine invariants', () => {
  it('no ability has two unguarded invokes with the same timing', () => {
    // The invocation tracker keys on (ability, timing, source) — after one
    // same-timing invoke fires, the rest are silently skipped for that pass.
    // Guarded invokes with mutually exclusive isCallable are a legitimate
    // pattern (Ssruu wraps every agent's invokes), but two UNGUARDED invokes
    // sharing a timing means the second can never fire.
    const violations: string[] = []
    for (const [ability, label] of collectAllAbilities()) {
      const unguarded = new Set<string>()
      for (const inv of ability.invoke) {
        if (inv.isCallable) continue
        if (unguarded.has(inv.timing)) {
          violations.push(
            `${label}: second unguarded '${inv.timing}' invoke never fires`,
          )
        }
        unguarded.add(inv.timing)
      }
    }
    expect(violations).toEqual([])
  })

  it('no two abilities share an invoke object', () => {
    // Invoke dedup is by object identity: two abilities sharing an invoke
    // object fire only once between them. Re-keyed clones must clone their
    // invokes too (see TF_MEDDLE in engine-gotchas.md).
    const violations: string[] = []
    const owner = new Map<object, string>()
    for (const [ability, label] of collectAllAbilities()) {
      for (const inv of ability.invoke) {
        const prev = owner.get(inv)
        if (prev !== undefined && prev !== label) {
          violations.push(
            `${label} shares an invoke object with ${prev} — clone the invoke`,
          )
        }
        owner.set(inv, label)
      }
    }
    expect(violations).toEqual([])
  })
})

// ── UI invariants ─────────────────────────────────────────────────────────
// Evaluate every panel-visible ability's uiConfig with a real read context
// (the same way AbilityConfig does), across every faction of both systems,
// with all unit types fielded and upgraded so unit-list sources are
// populated. Abilities with neither headerUI nor uiConfig (e.g. SETTINGS)
// are filtered out by the panel and skipped here too.

interface UiItem {
  key: unknown
  type: string
  defaultValue?: unknown
  min?: number
  max?: number
  items?: unknown
}

interface DisplayedEntry {
  ability: Ability
  items: UiItem[]
  params: Record<string, unknown>
  label: string
}

function collectDisplayed(): DisplayedEntry[] {
  const bySystem: Record<GameSystem, FactionKey[]> = {
    TI4: getFactionKeysBySystem('TI4'),
    TWILIGHTS_FALL: getFactionKeysBySystem('TWILIGHTS_FALL'),
  }

  const seen = new Set<Ability>()
  const out: DisplayedEntry[] = []

  for (const [system, keys] of Object.entries(bySystem) as [
    GameSystem,
    FactionKey[],
  ][]) {
    const setup = new CombatSetup()
    setup.setSystem(system)
    for (const side of ['attacker', 'defender'] as const) {
      for (const unitType of UNIT_TYPES) {
        setup.setUnitCount(side, unitType, 2)
        setup.setUpgraded(side, unitType, true)
      }
    }
    for (const factionKey of keys) {
      setup.setFaction('attacker', factionKey)
      setup.setFaction('defender', factionKey)
      for (const side of ['attacker', 'defender'] as const) {
        for (const reg of setup.getAvailableAbilities(side)) {
          const ability = reg.ability
          if (seen.has(ability)) continue
          // Same predicate the panel's hasUI filter applies.
          if (!ability.headerUI && !ability.uiConfig) continue
          seen.add(ability)

          const defaults = extractDefaults(ability)
          const params = {
            ...defaults,
            ...setup.abilities[side][ability.key],
          }
          let items: unknown
          if (typeof ability.uiConfig === 'function') {
            const ctx = setup.getReadContext(side) as AbilityReadContext & {
              ability?: Ability
            }
            const prev = ctx.ability
            ctx.ability = ability
            try {
              items = ability.uiConfig(ctx, params)
            } finally {
              ctx.ability = prev
            }
          } else {
            items = ability.uiConfig
          }
          out.push({
            ability,
            items: (items ?? []) as UiItem[],
            params,
            label: `${factionKey} ${ability.key}`,
          })
        }
      }
    }
  }
  return out
}

describe('UI invariants', () => {
  const displayed = collectDisplayed()

  it('collects a plausible number of displayed abilities', () => {
    expect(displayed.length).toBeGreaterThan(100)
  })

  it('headerUI params exist and numeric ones have finite defaults', () => {
    // A non-finite number renders as a blank input with a dead stepper
    // (the Sardakk Exotrireme "Uses" glitch).
    const violations: string[] = []
    for (const { ability, params, label } of displayed) {
      if (!ability.headerUI) continue
      const value = params[ability.headerUI]
      if (value === undefined) {
        violations.push(
          `${label} headerUI '${ability.headerUI}' has no param default`,
        )
      } else if (typeof value === 'number' && !isFinite(value)) {
        violations.push(
          `${label} headerUI '${ability.headerUI}' default is not finite — renders blank`,
        )
      }
    }
    expect(violations).toEqual([])
  })

  it('uiConfig items reference existing params', () => {
    const violations: string[] = []
    for (const { items, params, label } of displayed) {
      for (const item of items) {
        if (item.defaultValue !== undefined) continue
        if (!((item.key as string) in params)) {
          violations.push(
            `${label} uiConfig item '${String(item.key)}' has no matching param`,
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('number-type uiConfig items have finite defaults', () => {
    const violations: string[] = []
    for (const { items, params, label } of displayed) {
      for (const item of items) {
        if (item.type !== 'number') continue
        const value = item.defaultValue ?? params[item.key as string]
        if (typeof value !== 'number' || !isFinite(value)) {
          violations.push(
            `${label} number input '${String(item.key)}' default is ${String(value)} — renders blank`,
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('select-type uiConfig items have non-empty string values', () => {
    // Radix Select throws at render on value: '' — use a sentinel like
    // 'none' instead (see engine-gotchas.md). Empty option LISTS are fine
    // (e.g. Apollo's hero select before any unit is galvanized).
    const violations: string[] = []
    for (const { items, label } of displayed) {
      for (const item of items) {
        if (item.type !== 'select') continue
        const options = (
          item.items as ({ value: string } | { items: { value: string }[] })[]
        ).flatMap(entry => ('items' in entry ? entry.items : [entry]))
        for (const option of options) {
          if (typeof option.value !== 'string' || option.value.length === 0) {
            violations.push(
              `${label} select '${String(item.key)}' has an empty option value — Radix throws at render`,
            )
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
