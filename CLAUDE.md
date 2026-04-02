# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start dev server (Turbopack, http://localhost:3000)
yarn build      # Production build
yarn start      # Start production server
yarn lint       # Run ESLint
```

No test runner is configured yet.

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19**
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` in `globals.css` (no `tailwind.config.ts`; v4 uses CSS-first config)
- **TypeScript** with strict mode; path alias `@/*` maps to `src/*`
- **Package manager**: yarn 1.22.22 (version pinned via `.tool-versions` for asdf)

## Architecture

This is a fresh Next.js App Router project. All application code lives under `src/app/`.

**Tailwind v4 note**: Unlike v3, there is no `tailwind.config.ts`. Theme customization is done inside `globals.css` using `@theme inline { ... }`. CSS variables `--background` and `--foreground` drive the color scheme with automatic dark mode via `prefers-color-scheme`.

**Fonts**: Geist Sans and Geist Mono are loaded via `next/font/google` in `layout.tsx` and exposed as CSS variables (`--font-geist-sans`, `--font-mono`), mapped to Tailwind's `--font-sans` / `--font-mono` tokens inside `@theme`.

**ESLint**: Uses flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TypeScript rules.

## Related Projects

Sibling repos are available locally for research — use these instead of pulling Aztec files from GitHub:

- `../aztec-packages/` — Aztec monorepo (L1 contracts, Noir, Barretenberg, docs, etc.)
- `../staking-dashboard/` — Aztec staking dashboard (indexer, providers, Terraform, dashboard app)

## Design

The complete design for this project is in Figma. Always validate your implementation against it:
https://www.figma.com/design/t23mftqwj0pluRFnHEyIyL/Aztec-Dashboard?node-id=0-1&t=E6WP7kbPYBylZcQ1-1
