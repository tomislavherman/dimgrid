# dimgrid — API Reference

Full type signatures, behaviour details, and edge cases.

## `dimgrid(seed?)`

```typescript
function dimgrid(): DimGrid<{}>
function dimgrid<const T extends object>(seed: T | Iterable<T>): DimGrid<...>
```

Creates a new grid. All chains start here.

- **No argument** — a single empty point (`{}`).
- **A non-iterable object** — a starting set with that one point. Literal types are preserved via `const` inference: `dimgrid({ mode: 'fast' })` is `DimGrid<{ mode: 'fast' }>`.
- **An iterable of points** — a starting set with one point per element. Any object implementing `Symbol.iterator` counts: arrays, generator objects, other `DimGrid`s. All points must have the same keys — mixed shapes are a compile error. Same-shape literals collapse into one object type: `dimgrid([{ mode: 'fast' }, { mode: 'slow' }])` is `DimGrid<{ mode: 'fast' | 'slow' }>`.

`DimGrid.create(seed?)` is the equivalent static method.

**Seed semantics:**

- The seed iterable is stored by reference and **re-iterated lazily on every grid iteration**. Seeding from another grid keeps that grid's dynamic dimensions live — external state changes are reflected on the next iteration.
- One-shot iterables (generator objects) are exhausted after the first iteration; spread them into an array first if the grid is iterated more than once.
- Seed points are **not** deduplicated — duplicates yield duplicate outputs.
- Each yielded point is a copy; the original seed objects are never mutated or yielded.
- If a later `.dim(key, ...)` reuses a key present on the seed points, each point's own value is unioned with the dimension's values (deduped) per point, not overwritten:

```typescript
dimgrid({ mode: 'fast' }).dim('mode', ['slow']).toArray()
// [{ mode: 'fast' }, { mode: 'slow' }]
```

## `DimGrid<T>`

An immutable, lazy grid of typed points. Every method returns a new `DimGrid` — the original is never mutated.

### `.dim(key, values)`

```typescript
// Static values
dim<K extends string, const V>(
  key: K,
  values: readonly V[],
): DimGrid<T & { [P in K]: V }>

// Dynamic values (function form)
dim<K extends string, const V>(
  key: K,
  values: (point: T) => readonly V[],
): DimGrid<T & { [P in K]: V }>
```

Expands every existing point by the given values. For each existing point `P` and each value `V`, a new point `{ ...P, [key]: V }` is produced.

**Static form** (`values` is an array):
- Values are fixed at call time.
- `.size` is computed in O(dimensions) without iteration.

**Dynamic form** (`values` is a function):
- The function receives the current point (all keys added before this `.dim()` call) and returns the values for this dimension.
- Return `[]` to drop the point — it will not appear in the output.
- `.size` requires full iteration (O(points)) when any dimension uses a function.
- The function is called once per parent point during iteration, not at `.dim()` call time.

**Merging behaviour (duplicate key):**

If `key` already exists in the grid, the new values are merged into that dimension rather than adding a new one:

- Static + static → new static dimension with `deduped([...existing, ...new])` values.
- Static + dynamic or dynamic + anything → dynamic resolver that concatenates both result sets, then dedupes.

```typescript
dimgrid()
  .dim('x', [1, 2])
  .dim('x', [2, 3])  // merges: [1, 2, 3]
  .toArray()
// [{ x: 1 }, { x: 2 }, { x: 3 }]
```

### `.toArray()`

```typescript
toArray(): T[]
```

Materialises all points into a plain array. Equivalent to `[...grid]`.

### `.size`

```typescript
get size(): number
```

Returns the total number of points.

- **Static grids** (all dimensions use arrays; seed is empty or a single point): O(D) — multiplies dimension lengths, no iteration required. Result is cached after the first access.
- **Dynamic grids** (any dimension uses a function, or the grid was seeded with an iterable): O(N) — iterates all points and counts. Not cached, since resolvers and iterable seeds may change between calls.
- **Seed-key collisions** (a `.dim()` key also exists on a static seed point): O(N) — the per-point union breaks the product formula, but the result is still cached since everything is static.

### `[Symbol.iterator]`

```typescript
[Symbol.iterator](): Iterator<T>
```

Makes `DimGrid` directly iterable. Points are yielded lazily — no intermediate array is allocated.

```typescript
for (const point of grid) { ... }
const points = [...grid]
Array.from(grid)
```

### `DimGrid` class export

The class is exported for use in type annotations:

```typescript
import { DimGrid } from 'dimgrid'

function processGrid<T extends object>(grid: DimGrid<T>): T[] {
  return grid.toArray()
}
```

## Type inference

TypeScript infers the point type incrementally through the chain. The `const V` constraint preserves literal types rather than widening to `string` or `number`.

```typescript
const g1 = dimgrid()
//    ^? DimGrid<{}>

const g2 = g1.dim('color', ['red', 'green'])
//    ^? DimGrid<{ color: 'red' | 'green' }>

const g3 = g2.dim('size', ['S', 'M', 'L'])
//    ^? DimGrid<{ color: 'red' | 'green'; size: 'S' | 'M' | 'L' }>

const points = g3.toArray()
//    ^? { color: 'red' | 'green'; size: 'S' | 'M' | 'L' }[]
```

## Point generation order

Points are generated in **row-major order**: the first dimension added varies slowest, the last varies fastest.

```typescript
dimgrid()
  .dim('a', [1, 2])
  .dim('b', ['x', 'y'])
  .toArray()
// [{ a: 1, b: 'x' }, { a: 1, b: 'y' }, { a: 2, b: 'x' }, { a: 2, b: 'y' }]
```

## Deduplication details

Values are deduped using `JSON.stringify` equality when merging a duplicate key:

- Primitives: compared by value (`1 === 1`, `'a' === 'a'`)
- Plain objects: compared by serialised form — `{ x: 1 }` and `{ x: 1 }` are treated as the same
- `undefined`: `JSON.stringify(undefined)` returns `undefined` (not a string) — avoid `undefined` as a grid value
- Class instances: compared by their JSON representation, not by reference

## Exports

```typescript
import { dimgrid, DimGrid } from 'dimgrid'
```

| Export | Kind | Description |
|--------|------|-------------|
| `dimgrid` | function | Factory — creates an empty or seeded `DimGrid` |
| `DimGrid` | class | The grid class — useful for type annotations; `DimGrid.create(seed?)` mirrors the factory |
