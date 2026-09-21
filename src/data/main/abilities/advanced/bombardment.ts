import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  customPriority: boolean
  unitPriority: UnitList
  disableSustainDamage: boolean
}

declare global {
  interface AbilityConfigMap {
    BOMBARDMENT: Params
  }
}

export const bombardment: Ability<Params> = {
  key: 'BOMBARDMENT',
  name: 'Bombardment',
  description: 'Bombardment is resolved only when enabled',
  warning: 'Settings affect only normal Bombardment step',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
    customPriority: false,
    unitPriority: declareParam<UnitList>({
      default: [],
      source: 'GROUND_FORCES',
      side: 'opponent',
    }),
    disableSustainDamage: false,
  },
  side: 'attacker',
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'disableSustainDamage',
      label: 'Disable Sustain Damage',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'BOMBARDMENT_STEP',
      call: (ctx, params) =>
        ctx.resolveStep('BOMBARDMENT', {
          abilitiesOverride: params.disableSustainDamage
            ? { SUSTAIN_DAMAGE: false }
            : undefined,
        }),
    },
  ],
}
