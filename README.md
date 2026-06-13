# dimgrid

[![npm version](https://img.shields.io/npm/v/dimgrid)](https://www.npmjs.com/package/dimgrid)

Build a typed N-dimensional grid of objects by adding named dimensions with discrete values.

Start from a single empty point and expand it into a full cartesian product by adding dimensions one at a time. Each `.dim()` call multiplies every existing point by the number of values in the new dimension, attaching the dimension key to each resulting point.

## Install

```
npm install dimgrid
```

## Usage

```typescript
import { dimgrid } from 'dimgrid'

const points = dimgrid()
  .dim('color', ['red', 'green', 'blue'])
  .dim('size', ['S', 'M', 'L'])
  .toArray()

// 9 points — every combination of color × size
// [
//   { color: 'red',   size: 'S' },
//   { color: 'red',   size: 'M' },
//   { color: 'red',   size: 'L' },
//   { color: 'green', size: 'S' },
//   ...
// ]
```

TypeScript infers the full type of each point from the chain, so `points` is typed as `{ color: 'red' | 'green' | 'blue'; size: 'S' | 'M' | 'L' }[]`.

## Dynamic dimension values

Pass a function instead of an array to derive values from the point being expanded. The function receives the current point and returns the values for the new dimension. Return an empty array to drop a point entirely.

```typescript
const points = dimgrid()
  .dim('sign', [-1, 1])
  .dim('magnitude', ({ sign }) => sign > 0 ? [1, 2, 3] : [1])
  .toArray()

// [
//   { sign: -1, magnitude: 1 },
//   { sign:  1, magnitude: 1 },
//   { sign:  1, magnitude: 2 },
//   { sign:  1, magnitude: 3 },
// ]
```

## API

### `dimgrid()`

Creates a new grid with a single empty point. All grids start here.

### `grid.dim(key, values)`

Expands every existing point across the given values. Returns a new `DimGrid` — the original is not mutated.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Dimension name, becomes a property on each point |
| `values` | `readonly V[]` | One child point per value |
| `values` | `(point: T) => readonly V[]` | Values derived from the parent point; return `[]` to drop it |

### `grid.toArray()`

Returns all points as a plain `T[]`.

### `grid.size`

Number of points currently in the grid.

### `grid[Symbol.iterator]`

The grid is directly iterable — `for...of` and spread both work.

```typescript
for (const point of grid) { ... }
const points = [...grid]
```

---

## Examples

### Vitest — `test.each` with all dimension permutations

`test.each` accepts an array of objects and feeds each one as named arguments to the test function — a natural fit for dimgrid points. The dimension chain replaces manual case lists that grow stale as requirements change.

The example below tests a `clamp(value, min, max)` utility across all combinations of inputs and bounds. The function form of `.dim()` computes the expected result directly from each point's other dimensions, so no separate lookup table is needed and the expected value is always in sync with the inputs.

```typescript
import { describe, expect, test } from 'vitest'
import { dimgrid } from 'dimgrid'
import { clamp } from './clamp'

const cases = dimgrid()
  .dim('value',    [-20, 0, 10, 50])  // below range, at min, inside, above max
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

This produces **4 × 2 × 2 = 16 test cases** automatically, with names like:

```
clamp(-20, 0, 10) → 0
clamp(-20, 0, 30) → 0
clamp(-20, 5, 10) → 5
clamp(10, 0, 10)  → 10
clamp(50, 0, 10)  → 10
...
```

Adding a new boundary value to any dimension (say, `max: [10, 20, 30]`) inserts a full slice of tests with no further changes, keeping coverage complete across all combinations.

### Storybook — visual matrix of all component states

Design systems need stories for every meaningful prop combination. Writing them by hand is tedious and incomplete; dimgrid generates the full matrix and the function form prunes states that are visually invalid or redundant before they reach the story.

The example below covers a Button with four dimensions. A button cannot be both disabled and loading at the same time, so `loading` uses the function form to restrict itself to `[false]` whenever `disabled` is `true`.

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { dimgrid } from 'dimgrid'
import { Button } from './Button'

const meta: Meta<typeof Button> = { component: Button }
export default meta

const cases = dimgrid()
  .dim('variant',  ['primary', 'secondary', 'ghost', 'danger'])
  .dim('size',     ['sm', 'md', 'lg'])
  .dim('disabled', [false, true])
  .dim('loading',  ({ disabled }) => disabled ? [false] : [false, true])
  .toArray()
// 4 × 3 × 2 × 2 = 48 raw combinations, pruned to 36 by the loading constraint

export const AllVariants: StoryObj<typeof Button> = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {cases.map((props, i) => <Button key={i} {...props} />)}
    </div>
  ),
}
```

A single `AllVariants` story renders all 36 states in one snapshot. Visual regression tools like Chromatic catch regressions across the entire matrix on every commit. Adding a new `variant` value to the first dimension automatically propagates across all `size × disabled × loading` combinations with no other changes.

### ML hyperparameter grid search

Grid search — systematically training a model for every combination of hyperparameters and picking the best result — is where the name "grid" comes from. dimgrid generates the search space; the function form prunes configurations that are known to be numerically unstable before any training job is launched.

SGD diverges at high learning rates, so the `optimizer` dimension restricts itself to `['adam']` whenever `learningRate` exceeds `1e-3`:

```typescript
// grid-search.ts
import { dimgrid } from 'dimgrid'

const configs = dimgrid()
  .dim('learningRate', [1e-4, 1e-3, 1e-2])
  .dim('batchSize',    [32, 64, 128])
  .dim('dropout',      [0.0, 0.3, 0.5])
  .dim('optimizer',    ({ learningRate }) =>
    learningRate >= 1e-2 ? ['adam'] : ['adam', 'sgd']
  )
  .toArray()
// 3 × 3 × 3 × 2 = 54 raw combinations, pruned to 45

const results = await Promise.all(
  configs.map(params =>
    trainModel(params).then(({ valAccuracy, valLoss }) => ({
      ...params,
      valAccuracy,
      valLoss,
    }))
  )
)

const best = results.sort((a, b) => b.valAccuracy - a.valAccuracy)[0]
console.log('best config:', best)
```

`trainModel` is whatever launches a training run in your stack — a TensorFlow.js fit call, a Python subprocess, a remote job submitted to a GPU cluster. The dimgrid part is the same regardless.

The pruning matters at scale: a full 4-dimensional sweep without constraints wastes GPU hours on configurations that are guaranteed to fail. Adding a fifth dimension (say, `weightDecay`) multiplies the search space, but the function form keeps the invalid slice removed automatically.

---

## Credits

Thanks to [Santiago Arévalo](https://github.com/SantiagoMinka) for encouraging me to publish this as a library.
