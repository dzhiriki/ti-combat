import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const eidolonLandwaster: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_EIDOLON_LANDWASTER',
  icon: naazRokhaAllianceIcon,
  name: 'Eidolon Landwaster',
  description: 'Your mechs roll 1 additional die during combat.',
  unitType: 'MECH',
  stack: true,
  apply: ctx => {
    const combat = ctx.api.own.getUnitStats('MECH')?.COMBAT
    if (!combat) return
    ctx.api.own.modifyUnitType('MECH', {
      COMBAT: [combat[0], (combat[1] ?? 1) + 1],
    })
  },
})
