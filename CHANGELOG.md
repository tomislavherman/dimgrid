# Changelog

All notable changes to this project will be documented in this file.

## [0.2.2] - 2026-06-18

### Changed
- CI updated to Node.js 24
- `package-lock.json` now tracked for reproducible CI installs

## [0.2.1] - 2026-06-18

### Added
- CI workflow (GitHub Actions) and CI/bundle size badges in README

## [0.2.0] - 2026-06-18

### Added
- Lazy evaluation — grid items are computed on demand rather than eagerly
- Extending an existing dimension multiple times now merges values instead of duplicating the dimension

## [0.1.1] - 2026-06-12

### Changed
- Improved type inference to produce flat object types instead of intersections

## [0.1.0] - 2026-06-11

### Added
- Initial release
- `dimgrid()` factory function and `DimGrid` class
- `.dim(key, values)` to add named dimensions
- `.toArray()` and `.size` accessors
- Iterable support via `Symbol.iterator`
- Full TypeScript types with dual ESM/CJS build
