# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start dev server (Turbopack, http://localhost:3000)
yarn build            # Production build
yarn start            # Start production server
yarn lint             # Run ESLint
yarn test:e2e         # Playwright E2E suite (see src/test/e2e/)
yarn test:e2e:batched # E2E, one spec per Playwright run (fresh anvil each)
yarn test:fork        # Fork tests vs an Anvil mainnet fork (src/test/fork/)
yarn bootstrap-anvil  # Spin up + seed the Anvil fork the tests expect
```

There is no unit test runner; testing is Playwright E2E plus tsx-driven fork
tests against an Anvil mainnet fork.

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19**
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` in `globals.css` (no `tailwind.config.ts`; v4 uses CSS-first config)
- **TypeScript** with strict mode; path alias `@/*` maps to `src/*`
- **Package manager**: yarn 1.22.22 (version pinned via `.tool-versions` for asdf)

## Architecture

- `src/app/` — App Router routes: proposals list (`page.tsx` + `GovernanceClient.tsx`) and proposal detail (`[id]/`), plus `error.tsx`/`global-error.tsx`/`not-found.tsx` boundaries.
- `src/components/` — `governance/` (domain UI: VotingPowerPanel, Deposit/Withdraw/Vote modals, proposal rows), `ui/` (primitives), `layout/`, `providers/` (Web3Provider: wagmi + RainbowKit + react-query).
- `src/hooks/` — one hook per flow (useDeposit, useWithdraw, useVote, useVotingPower, useUserStakers, useWithdrawals, ...). Every flow has a direct path and a Staker-routed path for ATP (vault) holders.
- `src/lib/` — `config.ts` (env validation, throws at boot), `contracts.ts` (ABIs + addresses + server viem client), `governance.ts` (on-chain proposal reads), `indexer.ts` (staking-indexer API), `atp-discovery.ts` (on-chain fallback), `tx.ts` (revert-checking receipt guard).
- `src/proxy.ts` — Next middleware setting the nonce-based CSP.
- `src/test/` — `e2e/` (Playwright), `fork/` (tsx vs Anvil fork), `manual/`.

**Tailwind v4 note**: Unlike v3, there is no `tailwind.config.ts`. Theme customization is done inside `globals.css` using `@theme inline { ... }`; the palette lives in CSS variables like `--background-primary` and `--accent-primary`.

**Fonts**: Inter and Lora are loaded via `next/font/google` in `layout.tsx` and exposed as `--font-inter` / `--font-lora`, mapped to `--font-sans` / `--font-display` tokens inside `@theme`.

**ESLint**: Uses flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TypeScript rules.

## Related Projects

Sibling repos are available locally for research — use these instead of pulling Aztec files from GitHub:

- `../aztec-packages/` — Aztec monorepo (L1 contracts, Noir, Barretenberg, docs, etc.)
- `../staking-dashboard/` — Aztec staking dashboard (indexer, providers, Terraform, dashboard app)

## Design

The complete design for this project is in Figma. Always validate your implementation against it:
https://www.figma.com/design/t23mftqwj0pluRFnHEyIyL/Aztec-Dashboard?node-id=0-1&t=E6WP7kbPYBylZcQ1-1
