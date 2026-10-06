import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'
import type { SurfaceId } from '@/types'

const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId

export default {
  system: 'TI4',
  mode: 'GROUND',
  surfaces: [
    { id: 'space' as SurfaceId, type: 'SPACE', name: 'Space' },
    { id: P1, type: 'PLANET', name: 'Planet 1' },
    { id: P2, type: 'PLANET', name: 'Planet 2' },
  ],
  invasionPlanets: [P1, P2],
  attacker: {
    faction: 'ARBOREC',
    units: {},
    placements: {
      space: { INFANTRY: 5, MECH: 2 },
      [P2]: { INFANTRY: 4, MECH: 1 },
    },
  },
  defender: {
    faction: 'ARBOREC',
    units: {},
    placements: {
      [P1]: { INFANTRY: 5, MECH: 1, PDS: 1 },
      [P2]: { INFANTRY: 4, MECH: 1, PDS: 1 },
    },
  },
} satisfies CombatStateConfig
