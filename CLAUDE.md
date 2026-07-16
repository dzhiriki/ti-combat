# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Twilight Imperium battle simulator built with React, TypeScript, and Vite. The project uses modern React 19 with the React Compiler enabled for automatic optimization.

## Development Commands

```bash
# Start development server with HMR
npm run dev

# Type-check and build for production
npm run build

# Lint the codebase
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Lint CSS files
npm run lint:css

# Format code with Prettier
npm run format

# Check code formatting without modifying
npm run format:check

# Run tests (watch mode)
npm run test

# Run tests (single run)
npm run test:run

# Preview production build locally
npm run preview
```

## Tech Stack

- **React 19.2**: Latest React with compiler optimization enabled
- **TypeScript 5.9**: Strict mode enabled with comprehensive linting rules
- **Vite 7**: Build tool with Fast Refresh via @vitejs/plugin-react
- **ESLint 10**: Using flat config format with `defineConfig`/`globalIgnores` API
- **Prettier 3**: Code formatting with single quotes, 80 char width, no semicolons

## Build Configuration

### TypeScript

- Project uses TypeScript project references (tsconfig.app.json, tsconfig.node.json, tsconfig.profile.json, tsconfig.snapshots.json)
- Strict mode enabled with noUnusedLocals and noUnusedParameters
- Bundler module resolution
- Target: ES2024 (app), ES2023 (node)

### Vite

- React plugin configured with babel-plugin-react-compiler
- React Compiler is enabled globally (impacts dev/build performance but optimizes React rendering)

### ESLint

- Flat config format (eslint.config.js) using ESLint 10 `defineConfig` and `globalIgnores`
- Extends @eslint/js recommended, typescript-eslint recommended, react-hooks flat recommended, react-refresh vite config
- Plugins: simple-import-sort, check-file, react-refresh
- Browser globals configured
- Ignores dist and .worktrees directories
- Integrated with eslint-config-prettier to disable conflicting formatting rules

### Prettier

- Single quotes, no semicolons
- 80 character line width
- 2 space indentation
- LF line endings
- Arrow function parens: avoid

### Styling

- **Plain CSS Modules**: Each component has a `*.module.css` co-located with its TSX file; classes are imported as `import styles from './x.module.css'`
- **Design tokens**: All colors, fonts, spacing, font sizes, radii, and shadows are declared as CSS custom properties in `src/index.css` (`:root` for light theme, `.dark` for dark theme)
- **Dark Mode**: Class-based dark mode support (`.dark` class on `<html>`)
- **Path Aliases**: `@/` points to `src/` for clean imports
- **UI Components**: Custom components in `src/components/ui/` (select, sheet, and dialog use Radix primitives)
- **Conditional classes**: `clsx` is used directly for conditional class merging

## Code Conventions

- **Utilities**: One utility function per file in `src/utils/` (e.g., `getFactionUnitConfig.ts`)
- Console methods like info, time and timeEnd are find in production code, everything else — not
- All abilities test located in tests/abilities. If test is for a combination of abilities all abilities should be in filename with + between abilites, names sorted alphabetically. I.e. «cavalry+gravleash-maneuvers.test.ts». Exceptions: `assimilator-z` and `technological-singularity` always come first in both filename and describe block, in that order (e.g. `assimilator-z+technological-singularity+fourth-moon.test.ts`)
- Don't add explicit type annotations for callback parameters when TypeScript can infer them (e.g. ability `isCallable`/`call` callbacks get types from the `Ability<Params>` generic)

## Abilities

For abilities info — read `docs/abilities-list.md`.
When implementing a new ability, read `docs/abilities.md` first — it contains the full development guide with API reference, patterns, and code examples.
After implementation mark ability as done in `docs/abilities-list.md`.

## Engine Gotchas

Before implementing or debugging anything that touches the abilities engine, reconcile pipeline, dice-math kernel, or test harness, read `docs/engine-gotchas.md` — it lists non-obvious invariants (invoke dedup rules, participation vs ships, hit-received test conventions, etc.) that are expensive to rediscover. When you uncover a new invariant of this kind, add it there.

## Ability Testing

When writing or modifying ability tests, read `docs/testing.md` first — it contains the full testing guide with API reference, test patterns, and code examples.

## Pre-completion Checklist

Before claiming any implementation task is complete, ALWAYS run and verify these pass:

1. `npm run test:run` — all tests
2. `npm run build` — type-check and build
3. `npm run lint` — linting
4. `npm run format:check` — formatting

Do not consider work done until all pass. Fix any failures before finishing.
