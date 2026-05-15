# AGENTS.md

This file is read by AI coding agents (Claude Code, Codex CLI, Gemini CLI,
Cursor, Cline, Continue, Aider, etc.) per the https://agents.md/
convention. It applies to every agent regardless of which tool the
contributor is using.

## Project at a glance

`@ebarahona/loopback-openapi-v3` is a LoopBack 4 OpenAPI version
compatibility enhancer. It registers as an OAS Enhancer through
`@loopback/openapi-v3` and rewrites the generated spec to OAS 3.0, 3.1,
or 3.2 at spec-generation time, with nullable conversion and lossy
downgrade diagnostics. The transform is exported standalone as a pure
function (`transformOpenApiSpec`) for build-time use outside LoopBack.
Runtime: Node `>= 20.19.0`. License: MIT. Repository:
https://github.com/ebarahona/loopback-openapi-v3.

## Required reading

Read these in full before suggesting any change.

- [./STYLE_GUIDE.md](./STYLE_GUIDE.md): file naming, folder layout,
  binding keys, provider/component/lifecycle patterns, stability tags,
  peer-dependency policy, test layout, JSDoc rules, error handling,
  config validation, type-system rules, commit format, release
  engineering.
- [./CONTRIBUTING.md](./CONTRIBUTING.md): local setup, the
  `lint && build && test` gate, git hook paths (lefthook vs `.githooks`),
  PR expectations, release-please flow, bug-report requirements.
- LoopBack's official [`loopback-core` skill](https://github.com/loopbackio/loopback-next/tree/master/skills/loopback-core): upstream reference for IoC, dependency injection, extension points, interceptors, lifecycle observers, and components. Defer to this for framework patterns; STYLE_GUIDE.md only documents plugin-author conventions layered on top.
- LoopBack's [`@loopback/openapi-v3` OAS Enhancer extension point](https://loopback.io/doc/en/lb4/): upstream contract for how this plugin participates in spec generation.
- [./README.md](./README.md): package surface: component path vs
  pure-function path, supported target versions, downgrade diagnostics,
  typed error hierarchy, peer-dependency ranges.

## Workflow expectations

1. Every commit uses Conventional Commits. Allowed types: `feat`, `fix`,
   `docs`, `chore`, `ci`, `build`, `deps`, `perf`, `refactor`, `revert`,
   `style`, `test`. release-please derives `CHANGELOG.md` and the
   version bump from these. Incorrect types silently break the release.
2. Every commit carries a DCO sign-off (`git commit -s`). PRs without
   `Signed-off-by:` fail CI.
3. `npm run lint && npm run build && npm test` must pass locally before
   you propose a commit. Do not propose a commit you have not verified.
4. Pre-commit hooks (lefthook by default, `.githooks` as the
   zero-dependency fallback) run the same checks. Never skip them with
   `--no-verify`. If a hook reformats files, re-stage the changes and
   propose the commit again. Do not amend silently.
5. The transform is pure. Tests exercise real OpenAPI fixture documents;
   they do not mock `@loopback/openapi-v3`. Round-trip and conformance
   fixtures live in `src/__tests__/`. Any new behavior that touches
   `transform.ts` or the enhancer ships with a fixture-driven test.
6. New public exports default to `@experimental` JSDoc until at least
   one real consumer has exercised the surface; promote to `@public` in
   a separate PR.

## Architecture rules

- This plugin is an OAS Enhancer. The public surface is the component
  (`OpenApiVersionComponent`), the enhancer (`OpenApiVersionEnhancer`),
  and the pure transform utility (`transformOpenApiSpec`). New
  transforms add a new enhancer or extend `transform.ts`; the component
  is not modified.
- The transform is pure, deterministic, idempotent, and cacheable. The
  input spec is deep-cloned with `structuredClone` before any rewrite,
  so the caller's document is never mutated. The enhancer relies on
  LoopBack's spec cache rather than maintaining its own. Running the
  transform twice on the same input must produce identical output.
- The enhancer runs during OpenAPI spec generation, not at application
  start. There is no `@lifeCycleObserver` and no I/O. The component
  itself only registers bindings.
- Config is validated by a pure synchronous helper at the framework
  boundary. Invalid target versions or malformed config throw
  `OpenApiVersionConfigError`. Downgrades that cannot represent a
  load-bearing source field throw `OpenApiDowngradeError`. Structurally
  invalid input specs throw `OpenApiTransformError`. All errors derive
  from `OpenApiVersionError`.
- Every binding flows through `OpenApiVersionBindings.*` namespace
  constants declared in `src/keys.ts` with `BindingKey.create<T>(...)`;
  raw string binding keys are forbidden.
- TypeScript is strict and `any` is banned; an `as unknown as { ... }`
  cast into framework internals must carry a `// Why:` comment and a
  regression test that fails when the internal field is renamed.
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on.

## Claude Code users

Skills live at `.claude/skills/`. Invoke each as a slash command.

- `/lb4-plugin-review`: comprehensive PR review covering architecture,
  public API, and tests.
- `/lb4-style-check`: mechanical compliance scan against STYLE_GUIDE.md.
- `/lb4-public-api-audit`: public API surface diff and stability-tag
  check.
- `/new-openapi-feature`: scaffold a new transform or enhancer with
  binding, fixture, and conformance test.
- `/pre-pr-check`: full readiness gate before opening a PR.
- `/conventional-commit`: author a Conventional Commits message from
  the staged diff.

## Other tool users (Codex, Gemini, Cursor, Cline, Continue, Aider)

The skill files at `.claude/skills/<name>/SKILL.md` are plain Markdown.
Open the one matching your task and follow the instructions inside; the
workflow is identical regardless of how you invoke it.

If your tool has its own per-project config (Cursor's `.cursor/rules/`,
Cline's `.clinerules`, Continue's `.continuerules`, Aider's
`.aider.conf.yml`), point it at this file and [./STYLE_GUIDE.md](./STYLE_GUIDE.md)
so the conventions apply automatically on every turn.

## What NOT to do

- Don't mutate the input spec. `transformOpenApiSpec` clones via
  `structuredClone` before rewriting; new transforms must preserve that
  invariant.
- Don't bypass the spec cache for the same input. The transform is pure
  and idempotent; if you need to invalidate, change the input.
- Don't add `any` or `@ts-ignore` to silence a type error. Fix the
  underlying type.
- Don't throw raw `Error` from this package; use the typed hierarchy
  (`OpenApiVersionError` and subclasses).
- Don't modify global git config (`--global`); scope any required
  override to this repo with `--local`.
- Don't bypass pre-commit hooks with `--no-verify`.
- Don't hand-write `CHANGELOG.md` entries; release-please owns the file.
- Don't bump `package.json` `version` manually; release-please owns it.
- Don't add a default export anywhere in the package.
- Don't add files outside the folder structure documented in
  [./STYLE_GUIDE.md](./STYLE_GUIDE.md) § Folder structure.

## Communicating with the maintainer

- Bug reports:
  https://github.com/ebarahona/loopback-openapi-v3/issues
  (template: `.github/ISSUE_TEMPLATE/bug_report.yml`).
- Feature requests: same URL
  (template: `.github/ISSUE_TEMPLATE/feature_request.yml`).
- Security issues:
  https://github.com/ebarahona/loopback-openapi-v3/security/advisories/new.
  See [./SECURITY.md](./SECURITY.md).
- Code of conduct: [./CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
  (Contributor Covenant 2.1).
