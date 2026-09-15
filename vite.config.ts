/// <reference types="vitest" />
import { execSync } from 'child_process'
import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'html-branch-title',
      apply: 'serve',
      transformIndexHtml(html) {
        const branch = execSync('git rev-parse --abbrev-ref HEAD')
          .toString()
          .trim()
        return html.replace(
          /<title>(.*?)<\/title>/,
          `<title>[${branch}] $1</title>`,
        )
      },
    },
    react(),
  ],
  experimental: {
    // Bundling helps browser development but adds overhead to Vitest.
    bundledDev: process.env.VITEST !== 'true',
  },
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      cssModules: {
        pattern: '[name]-[hash]__[local]',
      },
    },
  },
  test: {
    globals: true,
    css: true,
    // Persist transforms locally; avoid the write cost in clean CI runs.
    fsModuleCache: !process.env.CI,
    testTimeout: 10000,
    setupFiles: [
      'tests/utils/expect.ts',
      'tests/utils/for-each-side.ts',
      'tests/utils/shuffle-abilities.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      'tests/snapshots',
    ],
  },
})
