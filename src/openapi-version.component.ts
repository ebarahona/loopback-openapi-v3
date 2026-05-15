import {Binding, createBindingFromClass} from '@loopback/core';
import type {Component} from '@loopback/core';
import {asSpecEnhancer} from '@loopback/openapi-v3';
import {OpenApiVersionBindings} from './keys';
import {OpenApiVersionEnhancer} from './openapi-version.enhancer';
import {DEFAULT_CONFIG} from './types';

/**
 * LoopBack 4 component that transforms OpenAPI spec output to 3.1 or 3.2.
 *
 * Usage:
 * ```ts
 * import {OpenApiVersionComponent, OpenApiVersionBindings} from '@ebarahona/loopback-openapi-v3';
 *
 * app.component(OpenApiVersionComponent);
 * app.bind(OpenApiVersionBindings.CONFIG).to({version: '3.1.0'});
 * ```
 *
 * @public
 */
export class OpenApiVersionComponent implements Component {
  bindings: Binding[] = [
    Binding.bind(OpenApiVersionBindings.CONFIG).to(DEFAULT_CONFIG),
    createBindingFromClass(OpenApiVersionEnhancer).apply(asSpecEnhancer),
  ];
}
