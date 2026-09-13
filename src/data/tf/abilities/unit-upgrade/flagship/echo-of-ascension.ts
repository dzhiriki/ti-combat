import nomadIcon from '@/assets/faction/nomad.svg?raw'
import type { Ability } from '@/combat'

// Relative to each faction's own flagship, so applied as adjustments
// rather than a stat block.
export const echoOfAscension: Ability = {
  key: 'TF_UPGRADE_ECHO_OF_ASCENSION',
  icon: nomadIcon,
  name: 'Echo of Ascension',
  description:
    'Adjust the printed values of your flagship: its MOVE value is increased by 1, its COMBAT value is reduced by 1, it rolls 1 additional die during combat, and its CAPACITY value is increased by 2.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_FLAGSHIP',
  invoke: [
    {
      timing: 'PREPARE',
      system: true,
      call: ctx => {
        const stats = ctx.api.own.getUnitStats('FLAGSHIP')
        if (!stats?.COMBAT) return
        ctx.api.own.modifyUnitType('FLAGSHIP', {
          COMBAT: [
            Math.max(1, stats.COMBAT[0] - 1),
            (stats.COMBAT[1] ?? 1) + 1,
          ],
          MOVE: (stats.MOVE ?? 0) + 1,
          CAPACITY: (stats.CAPACITY ?? 0) + 2,
        })
      },
    },
  ],
}
