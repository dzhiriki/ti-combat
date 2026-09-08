# AsyncTI4 fixtures

Board states captured from AsyncTI4's public game API
(`https://bot.asyncti4.com/api/public/game/<id>/web-data`) and trimmed to a
handful of tiles — enough to exercise the import without committing a 78 KB
payload.

Game names and player names are replaced with placeholders. Everything else is
left as it came: faction ids, colours, technologies and unit placement are the
vocabulary under test, and inventing them would defeat the point.

| File                       | Covers                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ti4-game.json`            | A base/PoK game: damaged and galvanized stacks, structures under a space battle, and the tokens and attachments that share the units' shape. |
| `twilights-fall-game.json` | A Twilight's Fall game: the colour faction ids, upgrades held as cards in `unitsOwned`, and the TF shared ability deck.                      |
| `active-combat.json`       | A game paused mid-battle, where `gameState.activeCombat` is the only thing pointing at the fight — nothing on its map looks contested.       |

Being snapshots, these never go stale on their own; the risk runs the other
way, that they keep passing against a payload shape AsyncTI4 has since changed.
`npm run check:asyncti4` probes live games for that — schema version, faction
and unit vocabulary, and the positional meaning of `unitStates`.

It takes the games to probe from `.asyncti4-games` at the repo root, one id per
line. That file is gitignored and holds no default: game ids point at other
people's games, and they go stale as those games finish. Create it once with a
couple of games in progress, or name them inline:

```sh
ASYNCTI4_GAMES=abc123,def456 npm run check:asyncti4
```

## Adding one

Prefer adding a fixture to re-cutting an existing one: the source games are
still being played, so a fresh capture moves the board out from under the
expectations in `../build-config.test.ts`.

```sh
curl -s https://bot.asyncti4.com/api/public/game/<id>/web-data > /tmp/game.json
```

Keep `versionSchema`, `gameRound`, `gameState.activeCombat`, the whole of
`playerData`, and only the tiles a test needs from `tileUnitData`. Then replace
`gameName`, `gameCustomName` and every `userName` with placeholders, and drop
any other field carrying a player's identity — `discordId` above all.
