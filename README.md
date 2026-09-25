# Twilight Imperium Combat Calculator

A combat odds calculator for **Twilight Imperium (4th Edition)**. Build any
space or ground combat, toggle the factions, units, technologies and abilities
involved, and get the exact probability of every outcome — win, loss, tie, and
the distribution of surviving units.

Built with React 19 and TypeScript, the simulation runs entirely in your
browser inside a web worker.

## Tech stack

- **React 19.2** with the React Compiler enabled
- **TypeScript 5.9** (strict)
- **Vite 7** for dev/build, **Vitest** for tests
- **CSS Modules** with design tokens; **Radix UI** primitives; **dnd-kit** for
  drag-and-drop
- **Zod** for schema validation, **Remeda** for data utilities
- Deployed on **Cloudflare Pages**, with a Pages Function + KV namespace
  backing the link shortener

## Getting started

Requires Node.js and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server with HMR
npm run build    # type-check and build for production
npm run preview  # preview the production build locally
```

## Project structure

```
src/
  combat/          simulation engine (framework-agnostic)
    abilities-engine/   ability registration, params, timings
    combat-engine/      phase loop and branch forking
    combat-state/       combat state model
    dice-math/          exact dice probability kernel
    combat.worker.ts    runs the engine off the main thread
  components/       React UI (simulator, panels, dialogs, ui primitives)
  data/            faction definitions, base units, ability data
  types/           shared type definitions
functions/         Cloudflare Pages Functions (URL shortener)
docs/              architecture and contribution guides
tests/             ability, snapshot, and benchmark tests
```

## Testing

```bash
npm run test            # unit/ability tests (watch mode)
npm run test:run        # single run
npm run test:shuffle    # re-run with shuffled order to catch ordering bugs
npm run test:snapshots  # snapshot tests
npm run bench           # compare performance against HEAD (or: -- <ref>)
```

`npm run bench` doesn't use stored baselines, because timings depend on the
machine. It extracts `src/` of the base ref, bundles it and the working tree
with the same harness from `tests/bench/`, and runs them in alternating rounds.
Only the per-round head/base ratio is reported. A scenario counts as slower or
faster only if the change exceeds `--threshold` (default 5%) and its 90%
confidence interval excludes zero. In CI, pushes to `main` are compared with
where `main` pointed before the push. Other branches and pull requests are
compared with the commit they forked from `main`. See `npm run bench -- --help`
for options.

Because results are computed by exact enumeration rather than sampling, tests
assert precise probabilities — there is no statistical flakiness to retry
around.

## Documentation

The `docs/` directory is the source of truth for contributors:

- [`abilities.md`](docs/abilities.md) — ability development guide and API
- [`abilities-list.md`](docs/abilities-list.md) — implementation status of every ability
- [`dice-math.md`](docs/dice-math.md) — the exact probability kernel
- [`testing.md`](docs/testing.md) — ability test patterns and helpers

## Acknowledgements

Twilight Imperium is a trademark of Fantasy Flight Games. This is an
unofficial fan project and is not affiliated with or endorsed by FFG.

## License

[MIT](LICENSE) © Aleksandr Petrov
