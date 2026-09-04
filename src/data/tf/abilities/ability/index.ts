import { ambush } from './ambush'
import { devotion } from './devotion'
import { dimensionalSplicer } from './dimensional-splicer'
import { harrow } from './harrow'
import { indoctrination } from './indoctrination'
import { munitionsReserves } from './munitions-reserves'
import { nonEuclideanShielding } from './non-euclidean-shielding'
import { planesplitter } from './planesplitter'
import { proximaTargetingVi } from './proxima-targeting-vi'
import { raidFormation } from './raid-formation'
import { createSingularity } from './singularity'
import { smotheringPresence } from './smothering-presence'
import { supercharge } from './supercharge'
import { tacticalBrilliance } from './tactical-brilliance'
import { tfTemporalCommandSuite } from './temporal-command-suite'
import { unrelenting } from './unrelenting'
import { valkyrieParticleWeave } from './valkyrie-particle-weave'
import { valkyrieVanguard } from './valkyrie-vanguard'
import { zealous } from './zealous'

export default [
  ambush,
  devotion,
  dimensionalSplicer,
  harrow,
  indoctrination,
  munitionsReserves,
  nonEuclideanShielding,
  planesplitter,
  proximaTargetingVi,
  raidFormation,
  createSingularity('X'),
  createSingularity('Y'),
  createSingularity('Z'),
  smotheringPresence,
  supercharge,
  tacticalBrilliance,
  tfTemporalCommandSuite,
  unrelenting,
  valkyrieParticleWeave,
  valkyrieVanguard,
  zealous,
]
