# Changelog

## Unreleased

### Features

- errors: add typed error hierarchy (`OpenApiVersionError` base, `OpenApiVersionConfigError`, `OpenApiTransformError`, `OpenApiDowngradeError`) replacing native `Error` throws
- stability: tag every public export with `@public` JSDoc

### Documentation

- README, AGENTS.md, HELP_WANTED.md aligned with `@ebarahona/loopback-*` portfolio voice and conventions

### Build

- 12 enterprise CI workflows added (ci, docs, release-please, codeql, dco, lychee, typos, scorecard, codeowners-validator, first-interaction, labeler, size-limit)
- `.githooks` + `scripts/install-hooks.sh` added for local Conventional Commits + lint enforcement
- `vitest.config.ts`, `typedoc.json`, `lychee.toml`, `.editorconfig` added
- `release-please-config.json` `package-name` corrected (was a copy-paste bug)
- `eslint.config.js` fixed (`require()` error)
- `tsconfig.json` gains `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`

## [1.1.0](https://github.com/ebarahona/loopback-openapi-v3/compare/loopback-openapi-v3-v1.0.0...loopback-openapi-v3-v1.1.0) (2026-05-15)


### Features

* add startup config debug logging for deployment diagnostics ([5a5156a](https://github.com/ebarahona/loopback-openapi-v3/commit/5a5156aca6689a240051c1ee422b9128a9221df6))
* add XML Object text field stripping for 3.2 downgrade ([c5b854c](https://github.com/ebarahona/loopback-openapi-v3/commit/c5b854c694e8ed8acf89462023ef6fcf9c188f90))
* complete 3.2 spec coverage and 3.1 feature stripping ([69b4eb6](https://github.com/ebarahona/loopback-openapi-v3/commit/69b4eb6c5e56d028a709e8da05559f428b5b2f5b))
* enterprise scaffolding parity with @ebarahona/loopback-* portfolio ([7ba5880](https://github.com/ebarahona/loopback-openapi-v3/commit/7ba58805c3cadd891a4a6f0c0b0dfc36bf280af5))
* enterprise-grade OpenAPI 3.0/3.1/3.2 version transformer ([31ac53b](https://github.com/ebarahona/loopback-openapi-v3/commit/31ac53bfdb25fba76077918a4a4b6f3a971421de))
* initial release of loopback-openapi-v3 component ([e69aacb](https://github.com/ebarahona/loopback-openapi-v3/commit/e69aacb2bc0baa5168492f6c204fb01cc2ea7dc8))
* v1-compatible core logic finalized ([f3ede00](https://github.com/ebarahona/loopback-openapi-v3/commit/f3ede00e75d69f41b0b172ab3de84217442b242e))


### Bug Fixes

* accurate JSDoc and warning count in debug output ([8a0ae22](https://github.com/ebarahona/loopback-openapi-v3/commit/8a0ae22fe60afd81f9740bf0bfeceac198f91a10))
* address enterprise-grade review feedback ([f137fed](https://github.com/ebarahona/loopback-openapi-v3/commit/f137fed3e44cc49b23495314a87f2ffb4741065b))
* **ci:** unblock typos and link check for v1.1.0 ([4dfeb31](https://github.com/ebarahona/loopback-openapi-v3/commit/4dfeb31b1e35e553c218bb98118d5f41fec4f381))
* **docs:** unparseable -&gt; unparsable in README typed-errors section ([7c646e1](https://github.com/ebarahona/loopback-openapi-v3/commit/7c646e1851a02122494edbf91d3ec15d1bd423a7))
* enterprise-grade hardening ([425e9e0](https://github.com/ebarahona/loopback-openapi-v3/commit/425e9e07d6ffe5ebef69a1448e727e148240ed2e))
* final enterprise-grade tweaks ([337326b](https://github.com/ebarahona/loopback-openapi-v3/commit/337326ba67fe58a3e63630d9b1968e1ab4ed32dd))


### Documentation

* align naming with OAI OpenAPI Style Guide ([c826c66](https://github.com/ebarahona/loopback-openapi-v3/commit/c826c66e17de2fbf8a234ccc73caeaaa670b1ab9))
* comprehensive README with full feature coverage table ([c243b0e](https://github.com/ebarahona/loopback-openapi-v3/commit/c243b0e07c2e39c78b38422b7decf0c70f9d1595))

## 1.0.0 (2026-05-14)

### ⚠ BREAKING CHANGES

- connector public API no longer accepts trailing callbacks on async methods. Use the returned promise. The juggler-callback contract required by `loopback-datasource-juggler@6.x` is preserved internally via a constructor-installed bridge and is invisible to TypeScript consumers.

### Features

- initial release of loopback-connector-mongodb ([2c163d1](https://github.com/ebarahona/loopback-connector-mongodb/commit/2c163d1ecd62864643ed64d174a5ca461dce98a1))
- pre-publish review polish — typed errors, change-stream lifecycle, hardening ([f6c2e33](https://github.com/ebarahona/loopback-connector-mongodb/commit/f6c2e33216a29da38e13bf8ca7e69cfa1b32263c))
- rebuild on driver 7 with shared-manager architecture and promise-only API ([5d84206](https://github.com/ebarahona/loopback-connector-mongodb/commit/5d8420641e403dddb1551b09fb0ecdc5193eb9cf))

### Bug Fixes

- address all review findings before publish ([be00d61](https://github.com/ebarahona/loopback-connector-mongodb/commit/be00d614d7500851ba4ae2a3766bd9051f2a28a2))
- **ci:** raise change-stream timeouts, add macOS to test matrix ([53a5a09](https://github.com/ebarahona/loopback-connector-mongodb/commit/53a5a0917e3f392e981413305e053bd1c45c276a))
- **ci:** regenerate lockfile with optional deps, fix broken README links ([86eca88](https://github.com/ebarahona/loopback-connector-mongodb/commit/86eca88e215a8e833caf87a2157267065ad8f398))
- **ci:** unblock first push — typos allowlist, stale URLs, lockfile sync ([44578ae](https://github.com/ebarahona/loopback-connector-mongodb/commit/44578aeda5412eb393227cea4802d05d6ea318e8))
- juggler callback compatibility and repository CRUD tests ([869d6fc](https://github.com/ebarahona/loopback-connector-mongodb/commit/869d6fc71163a3a6ce0b6e1ebc18384ec117afd3))
- resolve enterprise review lifecycle and ownership findings ([1007241](https://github.com/ebarahona/loopback-connector-mongodb/commit/10072411e275971b3dd5c506162e829836dfb075))

### Documentation

- add style guide, AGENTS.md, community files, and Claude Code skills ([538fded](https://github.com/ebarahona/loopback-connector-mongodb/commit/538fded5c62405867bd703d93dd113033b86547a))
- add Why section comparing to official connector ([e0dd15e](https://github.com/ebarahona/loopback-connector-mongodb/commit/e0dd15ed073af4ccb8c9a991601ab40dfe9516ea))

## Changelog

All notable changes from the first published release onward are documented here. Pre-release work happened on the `0.0.0` development branch and is not retroactively listed.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are generated by [release-please](https://github.com/googleapis/release-please) from [Conventional Commits](https://www.conventionalcommits.org/).
