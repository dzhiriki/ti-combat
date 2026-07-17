import type { Ability } from '@/combat'
import { UNIT_ABILITIES } from '@/constants/units'

// Twilight's Fall Abilities-deck card (from Crimson Rebellion's kit). The
// structure-presence/adjacency condition can't be derived in a single-system
// calculator, so enabling the card asserts it holds — the opponent's units
// then lose every unit ability (Sustain Damage, AFB, Bombardment, Space
// Cannon, Planetary Shield, ...).
export const smotheringPresence: Ability = {
  key: 'TF_SMOTHERING_PRESENCE',
  name: 'Smothering Presence',
  description:
    "Other players' units in or adjacent to systems that contain your structures lose all of their unit abilities.",
  warning:
    'Enable only when the combat system is in or adjacent to a system that contains your structures — the calculator cannot check this.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.opponent.setUnitAbilityLost(ability, ctx.this.key)
        }
      },
    },
  ],
}
