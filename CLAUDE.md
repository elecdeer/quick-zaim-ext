# CLAUDE.md

This file provides guidance for Claude Code (claude.ai/code) when working on code in this repository.

## Work Completion Guidelines

- Run `pnpm check` first when work is completed. You can use Biome's `--write` option for automatic fixes.

## Repository Overview

A monorepo project containing a browser extension and Cloudflare Workers API with Zaim (household budget service) integration. The browser extension is built using the WXT framework, and the API is provided by Cloudflare Workers.

## Common Commands

### Development & Build

```bash
# Browser Extension (packages/extension)
pnpm dev                     # Chrome development mode
pnpm dev:firefox             # Firefox development mode
pnpm build                   # Chrome build
pnpm build:firefox           # Firefox build
pnpm zip                     # Chrome distribution package
pnpm zip:firefox             # Firefox distribution package

# Cloudflare Workers (packages/workers)
pnpm dev                     # Local development server
pnpm deploy                  # Deploy to Cloudflare
pnpm wrangler:types          # Generate Cloudflare Workers type definitions

# Zaim API Type Generation (packages/zaim-api)
pnpm generate:openapi3       # Generate OpenAPI spec from TypeSpec
pnpm generate:ts-client      # Generate TypeScript type definitions
```

### Code Quality Checks

```bash
# Biome (root-level checks)
pnpm run check            # Lint, format, and organize imports
pnpm run check:fix        # Auto-fix
pnpm run check:fix:unsafe # Auto-fix with unsafe option

# TypeScript type checking
pnpm run typecheck        # Fast type checking

# Testing
pnpm run test            # Run all tests

# Other tools
pnpm knip                    # Unused code detection
```

## Architecture

### Package Structure

- **extension**: WXT-based browser extension (React + Tailwind CSS)
- **workers**: Cloudflare Workers API (Hono + AI SDK)
- **oauth**: OAuth 1.0a authentication library (for Zaim API)
- **zaim-api**: TypeSpec-based Zaim API type definitions

### Extension Architecture

- **entrypoints/background.ts**: Service worker
- **entrypoints/content.ts**: Content script
- **entrypoints/extract.content.ts**: DOM extraction content script
- **entrypoints/popup/**: React popup UI
- **entrypoints/playwright/**: Playwright-derived a11y utilities

### Workers API Architecture

- **handlers/**: API endpoints (extraction, zaim)
- **services/agent/**: AI & extraction services
- **services/zaim/**: Zaim API integration services
- Token management using Cloudflare KV
- Text extraction using Google AI (Gemini)

### API Type Definition System

Zaim API type definitions are written in TypeSpec and generate OpenAPI 3.0 specifications and TypeScript type definitions. Managed separately for each endpoint (account, category, genre, money, user, etc.).

## Development Notes

### Tool Configuration

- **Biome**: Lint, format, and organize imports
- **Knip**: Unused code detection (configuration managed in knip.json for each package)
- **TypeScript**: Project References support with type-checking-only configuration
  - Common settings managed in `tsconfig.base.json`
  - Generate only type definition files with `emitDeclarationOnly: true`
  - Accelerated with incremental type checking
- **pnpm**: Package manager (workspace configured)

### Permissions & Security

Extension uses the following permissions: storage, activeTab, scripting, identity, debugger
OAuth authentication and secure token management with Cloudflare KV are implemented.

## Testing Guidelines

### Vitest Testing Best Practices

- **Use test.extend**: Use Vitest's test.extend for fixture-based test setup instead of beforeEach
- **Avoid if statements**: Use assert for type narrowing instead of if statements for type checking in tests
  - Use `assert(R.isSuccess(result))` instead of `expect(R.isSuccess(result)).toBe(true)`
  - Type narrowing with assert allows type-safe access in subsequent code

### Test Execution

Test scripts are added to each package. Use pnpm's `-F` option to run tests for specific packages:

```bash
# Run tests for specific packages
pnpm -F @repo/workers run test              # workers package tests
pnpm -F @repo/oauth run test                # oauth package tests
pnpm -F @repo/zaim-api run test             # zaim-api package tests
pnpm -F extension run test                  # extension package tests

# Browser tests for extension package
pnpm -F extension run test:browser

# Run specific test files
pnpm -F @repo/workers run test src/services/cache/kvCache.test.ts
pnpm -F extension run test:browser entrypoints/sidepanel/components/AuthButtons.test.browser.tsx

```

#### Package-specific Features

- **workers**: Uses vitest.config.unit.ts for Cloudflare Workers environment
- **extension**: Supports both unit tests and browser tests (vitest.config.unit.ts / vitest.config.browser.ts)
- **oauth**: Standard Vitest tests (vitest.config.unit.ts)
- **zaim-api**: Standard Vitest tests (vitest.config.unit.ts, currently no test files)
