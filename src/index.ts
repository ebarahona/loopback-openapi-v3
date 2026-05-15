/**
 * Public entry point for `@ebarahona/loopback-openapi-v3`.
 *
 * Re-exports the component, enhancer, binding keys, configuration
 * types, the pure transform functions, and the typed error hierarchy.
 *
 * @packageDocumentation
 */

/** @public */
export {OpenApiVersionComponent} from './openapi-version.component';
/** @public */
export {OpenApiVersionEnhancer} from './openapi-version.enhancer';
/** @public */
export {OpenApiVersionBindings} from './keys';
/** @public */
export type {OpenApiVersion, OpenApiVersionConfig} from './types';
/** @public */
export {transformOpenApiSpec, parseVersion} from './transform';
/** @public */
export type {TransformResult, TransformWarning} from './transform';
/** @public */
export {
  OpenApiVersionError,
  OpenApiVersionConfigError,
  OpenApiTransformError,
  OpenApiDowngradeError,
} from './errors';
/** @public */
export type {OpenApiErrorOptions} from './errors';
