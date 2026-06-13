# Changelog

All notable changes to this project will be documented in this file.

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
