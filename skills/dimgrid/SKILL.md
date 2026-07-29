---
name: dimgrid
description: 'Generate typed N-dimensional Cartesian product grids in JavaScript/TypeScript. Use when a JS/TS project (package.json present) needs all combinations of named values: parameterised test suites (vitest test.each, jest, mocha), Storybook visual matrices, ML hyperparameter grid search, A/B test variant enumeration, or any combinatorial enumeration. Activate when user mentions "all combinations", "cartesian product", "grid search", "test matrix", "every variant", or "permutations of props/params". Also activates when writing test.each or similar parametrised test patterns. Check package.json; install dimgrid if absent from dependencies.'
license: MIT
compatibility: JavaScript or TypeScript projects using npm, yarn, or pnpm. Node.js 16+. ESM and CommonJS both supported. Browser-compatible (no Node.js APIs used).
metadata:
  author: tomislavherman
  version: "0.2.6"
---

# dimgrid

Build a typed N-dimensional grid of objects by chaining named dimensions. Each `.dim()` call stores dimension metadata; the Cartesian product is computed lazily on iteration or `.toArray()`.

See [API reference](references/api.md) for complete type signatures and edge cases.

## When to use

- Writing parametrised tests and need all combinations of inputs (`vitest test.each`, Jest, Mocha)
- Generating a Storybook story that covers every prop combination for a component
- Running a hyperparameter grid search
- Enumerating valid configurations or states from independent axes
- Any task where the phrase "every combination of X and Y" comes up

**Do not use** for permutations (order matters) or when values depend on external async data — dimgrid is synchronous.

## Setup

Check whether dimgrid is already installed:

```bash
grep '"dimgrid"' package.json
```

If not found, install it:

```bash
npm install dimgrid
```

Import the factory function:

```typescript
import { dimgrid } from 'dimgrid'        // ESM / TypeScript
const { dimgrid } = require('dimgrid')   // CommonJS
```

## Quick start

```typescript
import { dimgrid } from 'dimgrid'

const points = dimgrid()
  .dim('color', ['red', 'green', 'blue'])
  .dim('size',  ['S', 'M', 'L'])
  .toArray()
// 9 points — { color: 'red' | 'green' | 'blue', size: 'S' | 'M' | 'L' }[]
```

TypeScript infers the full union type of each property from the chain — no type assertions needed.

## API summary

| Member | Returns | Notes |
|--------|---------|-------|
| `dimgrid()` | `DimGrid<{}>` | Creates a grid with one empty point |
| `dimgrid(point)` | `DimGrid<T>` | Seeds the grid with one starting point (non-iterable object) |
| `dimgrid(points)` | `DimGrid<T>` | Seeds with an iterable of same-shaped points — arrays, generators, or another grid |
| `.dim(key, values[])` | `DimGrid<T & {key: V}>` | Static values — expands every point |
| `.dim(key, fn)` | `DimGrid<...>` | Dynamic values derived from the point so far |
| `.toArray()` | `T[]` | Materialises all points |
| `.size` | `number` | Point count; O(D) for static grids, O(N) for dynamic dims or iterable seeds |
| `[Symbol.iterator]` | `Iterator<T>` | Iterable — `for...of` and spread work |

Calling `.dim()` with an existing key **merges** values into that dimension (deduped) rather than adding a new one. If the key exists on the *seed points*, each point's own value is unioned with the dimension's values per point.

See [references/api.md](references/api.md) for full signatures and merge/dedup rules.

## Common patterns

### vitest `test.each` — parametrised test matrix

```typescript
import { describe, expect, test } from 'vitest'
import { dimgrid } from 'dimgrid'
import { clamp } from './clamp'

const cases = dimgrid()
  .dim('value',    [-20, 0, 10, 50])
  .dim('min',      [0, 5])
  .dim('max',      [10, 30])
  .dim('expected', ({ value, min, max }) => [
    value < min ? min : value > max ? max : value,
  ])
  .toArray()

describe('clamp', () => {
  test.each(cases)(
    'clamp($value, $min, $max) → $expected',
    ({ value, min, max, expected }) => {
      expect(clamp(value, min, max)).toBe(expected)
    },
  )
})
```

`4 × 2 × 2 = 16` test cases generated automatically. Adding a value to any dimension inserts a full slice of tests with no other changes.

### Storybook — visual matrix

```tsx
import { dimgrid } from 'dimgrid'
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = { component: Button }
export default meta

const cases = dimgrid()
  .dim('variant',  ['primary', 'secondary', 'ghost', 'danger'])
  .dim('size',     ['sm', 'md', 'lg'])
  .dim('disabled', [false, true])
  .dim('loading',  ({ disabled }) => disabled ? [false] : [false, true])
  .toArray()
// 4 × 3 × 2 × 2 = 48, pruned to 36 by the loading constraint

export const AllVariants: StoryObj<typeof Button> = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {cases.map((props, i) => <Button key={i} {...props} />)}
    </div>
  ),
}
```

### Pruning invalid combinations

Return `[]` from the function form to drop a point entirely:

```typescript
const cases = dimgrid()
  .dim('role',   ['admin', 'editor', 'viewer'])
  .dim('action', ({ role }) =>
    role === 'viewer' ? ['read'] : ['read', 'write', 'delete']
  )
  .toArray()
// viewer gets only 'read'; admin and editor get all three
```

### Seeding and composing grids

Pass a starting point (or an iterable of same-shaped points) to the factory instead of starting empty. Since a `DimGrid` is iterable, one grid can seed another:

```typescript
const base = dimgrid({ env: 'prod' })            // one starting point
const grid = dimgrid(base).dim('region', ['eu', 'us'])  // seed from another grid
// [{ env: 'prod', region: 'eu' }, { env: 'prod', region: 'us' }]
```

Literal types are preserved: `dimgrid([{ mode: 'fast' }, { mode: 'slow' }])` is `DimGrid<{ mode: 'fast' | 'slow' }>`. Mixed-shape seed points are a compile error.

### Lazy iteration (no full array in memory)

```typescript
for (const point of grid) {
  // process one point at a time
}

const points = [...grid]  // spread also works
```

## Gotchas

- **Duplicate keys merge, not append.** Calling `.dim('color', ['blue'])` after `.dim('color', ['red'])` produces one dimension with `['red', 'blue']` (deduped), not two passes. Use different keys to keep dimensions separate.
- **`.size` triggers full iteration on dynamic grids.** If any dimension uses a function — or the grid was seeded with an iterable — `.size` iterates all points. Cache the result if you call it repeatedly.
- **Iterable seeds are re-iterated lazily.** Seeding from another grid keeps its function dimensions live, but a one-shot iterable (generator object) is exhausted after the first iteration — spread it into an array first.
- **Seed keys reused by `.dim()` union per point.** `dimgrid({ mode: 'fast' }).dim('mode', ['slow'])` yields both `{ mode: 'fast' }` and `{ mode: 'slow' }` — the seed value is not overwritten.
- **Values are deduped by `JSON.stringify`.** Primitives and plain objects work as expected. Class instances with the same JSON representation are treated as duplicates.
- **Synchronous only.** Resolver functions must be synchronous. Resolve async data outside dimgrid and pass the resolved values in.
- **Order is row-major.** The first dimension added varies slowest; the last varies fastest.
