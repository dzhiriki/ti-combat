import type { Ability, SettingsParams } from '@/combat'
import {
  GROUND_FORCES,
  NON_FIGHTER_SHIPS,
  SHIPS,
  STRUCTURES,
} from '@/constants/units'
import type { UnitBaseType } from '@/types'

declare global {
  interface AbilityConfigMap {
    SETTINGS: SettingsParams
  }
}

export const settings: Ability<SettingsParams> = {
  key: 'SETTINGS',
  name: 'Settings',
  params: {
    isEnabled: true,
    uses: Infinity,
    ships: SHIPS,
    nonFighterShips: NON_FIGHTER_SHIPS,
    groundForces: GROUND_FORCES,
    structures: STRUCTURES,
    units: [...SHIPS, ...GROUND_FORCES, ...STRUCTURES],
    spaceCombatParticipating: [],
    groundCombatParticipating: [],
    validTargetsSpaceCannonOffense: SHIPS,
    validTargetsBombardment: [],
    validTargetsSpaceCannonDefense: [],
    validTargetsAntiFighterBarrage: ['FIGHTER'],
    subtypes: [],
  },
  onParamSet(params, key) {
    if (key === 'ships') {
      params.nonFighterShips = (params.ships as UnitBaseType[]).filter(
        u => u !== 'FIGHTER',
      )
      params.spaceCombatParticipating = params.ships
      params.validTargetsSpaceCannonOffense = params.ships
    } else if (key === 'groundForces') {
      params.groundCombatParticipating = params.groundForces
      params.validTargetsBombardment = params.groundForces
      params.validTargetsSpaceCannonDefense = params.groundForces
    } else if (key !== 'structures') {
      return
    }
    params.units = [
      ...(params.ships as UnitBaseType[]),
      ...(params.groundForces as UnitBaseType[]),
      ...(params.structures as UnitBaseType[]),
    ]
    return params
  },
  invoke: [],
}
