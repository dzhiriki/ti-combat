import { type Ability } from '@/combat'

declare global {
  interface AbilityConfigMap {
    GRAVITON_LASER_SYSTEM: Record<string, never>
  }
}

export const gravitonLaserSystem: Ability = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  description:
    'You may exhaust this card before 1 or more of your units use Space Cannon; hits produced by those units must be assigned to non-fighter ships if able.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [],
}
