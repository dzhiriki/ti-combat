# AsyncTI4 fixtures

Trimmed snapshots of real games from [asyncti4.com](https://asyncti4.com),
fetched from `https://bot.asyncti4.com/api/public/game/<id>/web-data`. Each
keeps the full `playerData` and a handful of tiles — enough to exercise the
import without committing a 78 KB payload.

| File                       | Game       | Kept for                                                                                                                                |
| -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ti4-game.json`            | `sample-ti4` | A TI4 game: damaged and galvanized stacks, structures under a space battle, and the tokens and attachments that share the units' shape. |
| `twilights-fall-game.json` | `sample-tf` | A Twilight's Fall game: the colour faction ids, upgrades held as cards in `unitsOwned`, and the TF shared ability deck.                 |
| `active-combat.json`       | `sample-combat` | A game paused mid-battle, where `gameState.activeCombat` is the only thing pointing at the fight — nothing on its map looks contested.  |

These are snapshots, so they never go stale on their own; the risk is the
opposite, that they keep passing against a payload shape AsyncTI4 has since
changed. `npm run check:asyncti4` fetches these same games live and checks the
assumptions the import rests on — schema version, faction and unit vocabulary,
and the positional meaning of `unitStates`.

## Refreshing one

The games are live and still being played, so re-cutting a fixture will change
its board state and the expectations in `../build-config.test.ts` along with it.
Prefer adding a new fixture over refreshing an existing one, unless the payload
shape itself has moved.

```sh
curl -s https://bot.asyncti4.com/api/public/game/<id>/web-data > /tmp/game.json
```

Then keep `versionSchema`, `gameName`, `gameCustomName`, `gameRound`,
`gameState.activeCombat`, the whole of `playerData`, and only the tiles a test
needs from `tileUnitData`.
