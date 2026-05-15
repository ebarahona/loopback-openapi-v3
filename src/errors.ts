/**
 * Typed error classes for the OpenAPI version transformer.
 *
 * Each class extends `Error` and overrides `name` so consumers can match
 * failures either by `instanceof` or by `error.name`. Throw the most
 * specific subclass for the failure category; never raw `Error`.
 *
 * The `Object.setPrototypeOf(this, new.target.prototype)` call in the
 * base class is required so `instanceof` checks work correctly in
 * transpiled output (TypeScript/ES5 lose the prototype chain when
 * extending built-in classes like `Error`).
 */

/**
 * Options accepted by `Error` constructors at runtime in Node.js 18+.
 * Declared locally because the project targets ES2021 and the global
 * `ErrorOptions` type ships in ES2022 libs.
 *
 * @public
 */
export interface OpenApiErrorOptions {
  cause?: unknown;
}

/**
 * Base error for all OpenAPI version-transformer failures.
 * Consumers can catch this to handle any failure from the plugin.
 *
 * @public
 */
export class OpenApiVersionError extends Error {
  override readonly name: string = 'OpenApiVersionError';
  readonly cause?: unknown;
  constructor(message: string, options?: OpenApiErrorOptions) {
    super(message);
    // Preserve `cause` at runtime. Node 18+'s Error constructor accepts
    // an options.cause natively; the project targets ES2021 libs where
    // that overload is not declared, so we set the property manually.
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the component is misconfigured (invalid target version,
 * unsupported transform mode, missing required binding, etc.).
 *
 * @public
 */
export class OpenApiVersionConfigError extends OpenApiVersionError {
  override readonly name = 'OpenApiVersionConfigError';
}

/**
 * Thrown when an OpenAPI document fails to transform between versions
 * (malformed input, unparsable structure, ambiguous nullable usage).
 *
 * @public
 */
export class OpenApiTransformError extends OpenApiVersionError {
  override readonly name = 'OpenApiTransformError';
}

/**
 * Thrown when a 3.1+ feature cannot be downgraded to 3.0 without data
 * loss (e.g. webhooks, JSON Schema 2020-12 vocabularies, type arrays).
 * The thrown error carries a structured list of features that prevented
 * the downgrade so callers can react.
 *
 * @public
 */
export class OpenApiDowngradeError extends OpenApiVersionError {
  override readonly name = 'OpenApiDowngradeError';
  constructor(
    message: string,
    public readonly unsupportedFeatures: readonly string[],
    options?: OpenApiErrorOptions,
  ) {
    super(message, options);
  }
}
