import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CombatOutcome } from '@/combat'
import { BattleCard } from '@/components/battle-card'
import { CombatSetup } from '@/hooks/combat-setup'
import type { SurfaceId } from '@/types'
import { getCombatResult } from '@/utils/get-combat-result'
import { getPlanetReports } from '@/utils/get-planet-reports'

const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId

function render(outcomes: CombatOutcome[]) {
  const setup = new CombatSetup('FULL')
  setup.setCombatMode('GROUND')
  setup.addPlanet()
  const noop = () => {}
  return renderToStaticMarkup(
    <BattleCard
      system={setup.system}
      onSystemChange={noop}
      attackerFaction={setup.attackerFaction}
      defenderFaction={setup.defenderFaction}
      attackerSelections={setup.attackerSelections}
      defenderSelections={setup.defenderSelections}
      editorMode={setup.editorMode}
      surfaces={setup.surfaces}
      selectedPlanetId={setup.selectedPlanetId}
      surfaceSelections={setup.surfaceSelections}
      attackerConfig={setup.getUnitConfig('attacker')}
      defenderConfig={setup.getUnitConfig('defender')}
      combatResult={getCombatResult(outcomes)}
      outcomes={outcomes}
      planetReports={getPlanetReports(outcomes, setup.surfaces)}
      unitPriority={{ attacker: [], defender: [] }}
      participatingTypes={{ attacker: [], defender: [] }}
      combatMode={setup.combatMode}
      onCombatModeChange={noop}
      onPlanetChange={noop}
      onAddPlanet={noop}
      onRemovePlanet={noop}
      onReorderPlanets={noop}
      onFactionChange={noop}
      onSwap={noop}
      onUnitCountChange={noop}
      onSurfaceUnitCountChange={noop}
      onUpgradeToggle={noop}
      onResetUnits={noop}
    />,
  )
}

const outcome = (
  winner: CombatOutcome['winner'],
  planetWinners?: CombatOutcome['planetWinners'],
): CombatOutcome => ({
  attacker: {},
  defender: {},
  attackerSurfaces: {},
  defenderSurfaces: {},
  winner,
  planetWinners,
  probability: 1,
})

describe('combat results', () => {
  it('shows a combined bar and one bar per invaded planet', () => {
    const html = render([
      outcome('draw', { [P1]: 'attacker', [P2]: 'defender' }),
    ])

    expect(html).toContain('>All planets<')
    expect(html).toContain('>Mixed<')
    expect(html).toContain('>Planet 1</h3>')
    expect(html).toContain('>Planet 2</h3>')
    // Only the planet bars offer a Detailed table.
    expect(html.split('>Detailed<')).toHaveLength(3)
  })

  it('shows a single bar for a single-planet combat', () => {
    const html = render([outcome('attacker')])

    expect(html).not.toContain('All planets')
    expect(html).toContain('>Draw<')
    expect(html.split('>Detailed<')).toHaveLength(2)
  })
})
