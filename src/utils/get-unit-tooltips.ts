import {
  type Ability,
  extractDefaults,
  hasStaticInvokes,
  type SideAbilitiesConfig,
} from '@/combat'
import { UNIT_DISPLAY_NAMES, UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  GameSystem,
  UnitBaseType,
  UnitSelection,
  UnitStats,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'
import { getGameData } from './get-game-data'
import { getEffectiveStats } from './get-simulation-units'
import { isStatsInvoke } from './is-stats-invoke'
import { isStatsTransformInvoke } from './is-stats-transform-invoke'

export interface UnitTooltipAbility {
  name: string
  description?: string
}

export interface UnitTooltipData {
  name: string
  faction: string
  stats: UnitStats
  textAbilities: UnitTooltipAbility[]
  copiedAbilities: UnitTooltipAbility[]
}

interface UnitTooltipsInput {
  system: GameSystem
  faction: string
  side: CombatSide
  selections: Record<UnitBaseType, UnitSelection>
  abilities: SideAbilitiesConfig
}

function enabled(
  ability: Ability,
  config: SideAbilitiesConfig,
  respectHeader = false,
): boolean {
  const params = { ...extractDefaults(ability), ...config[ability.key] }
  return (
    !!params.isEnabled &&
    (!respectHeader || !ability.headerUI || !!params[ability.headerUI])
  )
}

/** Resolve reference cards from selected printed definitions, never combat state. */
export function getUnitTooltips({
  system,
  faction,
  side,
  selections,
  abilities,
}: UnitTooltipsInput): Record<UnitBaseType, UnitTooltipData> {
  const gameData = getGameData(system)
  const definitions = getFactionUnitConfig(system, faction)
  const upgradedTypes = new Set(
    UNIT_TYPES.filter(type => selections[type].upgraded),
  )
  const available = gameData.getAvailableAbilities(side, faction, upgradedTypes)
  const selected = available.filter(ability => enabled(ability, abilities))
  const copiedUnits = new Map<UnitBaseType, UnitStats>()

  if (system === 'TI4' && faction === 'NEKRO_VIRUS') {
    const selectedKeys = new Set(selected.map(ability => ability.key))
    for (const [source, definition] of Object.entries(gameData.factions)) {
      for (const type of UNIT_TYPES) {
        const unit = definition.units[type]
        if (unit && selectedKeys.has(`NEKRO_UNIT_${source}_${type}`)) {
          copiedUnits.set(
            type,
            getEffectiveStats(unit.BASE, unit.UPGRADED, true),
          )
        }
      }
    }
  }

  const result = {} as Record<UnitBaseType, UnitTooltipData>
  for (const type of UNIT_TYPES) {
    const definition = definitions[type]
    let stats =
      copiedUnits.get(type) ??
      getEffectiveStats(
        definition.BASE,
        definition.UPGRADED,
        selections[type].upgraded,
      )
    let name =
      stats.NAME ??
      `${UNIT_DISPLAY_NAMES[type]}${definition.UPGRADED ? ' I' : ''}`
    const upgradeText: UnitTooltipAbility[] = []

    if (system === 'TF') {
      for (const ability of selected) {
        if (
          ability.slot !== `UNIT_UPGRADE_${type}` ||
          !hasStaticInvokes(ability)
        )
          continue
        for (const invoke of ability.invoke) {
          if (isStatsInvoke(invoke) && invoke.unitType === type) {
            // Native stat blocks replace nested ability maps, just like modifyUnitType.
            stats = { ...stats, ...invoke.stats }
            name = invoke.stats.NAME ?? ability.name
          } else if (
            isStatsTransformInvoke(invoke) &&
            invoke.unitType === type
          ) {
            stats = { ...stats, ...invoke.transform(stats) }
          }
        }
        if (ability.description)
          upgradeText.push({
            name: ability.name,
            description: ability.description,
          })
      }
    }

    const seenDescriptions = new Set<string>()
    const textAbilities: UnitTooltipAbility[] = []
    const addText = (name: string, description?: string) => {
      if (!description || seenDescriptions.has(description)) return
      seenDescriptions.add(description)
      textAbilities.push({ name, description })
    }
    addText('', stats.DESCRIPTION)
    for (const ability of stats.ABILITIES ?? []) {
      if (ability.key.startsWith('NEKRO_FLAGSHIP_')) continue
      if (
        ability.key === 'SUSTAIN_DAMAGE' ||
        ability.key === 'PLANETARY_SHIELD'
      )
        continue
      addText(ability.name, ability.description)
    }
    for (const ability of upgradeText)
      addText(ability.name, ability.description)
    const deploy = stats.UNIT_ABILITIES?.DEPLOY
    if (deploy) addText('Deploy', deploy.description)

    const copiedAbilities = (stats.ABILITIES ?? [])
      .filter(
        ability =>
          ability.key.startsWith('NEKRO_FLAGSHIP_') &&
          enabled(ability, abilities, true),
      )
      .map(ability => ({
        name: ability.name,
        description: ability.description,
      }))

    result[type] = {
      name,
      faction: gameData.getFaction(faction).name,
      stats,
      textAbilities,
      copiedAbilities,
    }
  }
  return result
}
