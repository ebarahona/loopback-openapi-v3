import {
  Binding,
  Component,
  config,
  createBindingFromClass,
  injectable,
} from '@loopback/core';
import {OASEnhancerBindings} from '@loopback/openapi-v3';
import {OpenApiVersionBindings} from './keys';
import {OpenApiVersionEnhancer} from './openapi-version.enhancer';
import {DEFAULT_CONFIG, OpenApiVersionConfig} from './types';

/**
 * LoopBack 4 component that upgrades OpenAPI spec output to 3.1 or 3.2.
 *
 * Usage:
 * ```ts
 * app.configure(OpenApiVersionComponent.BINDING_KEY).to({version: '3.1.0'});
 * app.component(OpenApiVersionComponent);
 * ```
 *
 * Or with shorthand:
 * ```ts
 * app.component(OpenApiVersionComponent);
 * app.bind(OpenApiVersionBindings.CONFIG).to({version: '3.2.0'});
 * ```
 */
@injectable()
export class OpenApiVersionComponent implements Component {
  static BINDING_KEY = OpenApiVersionBindings.COMPONENT;

  bindings: Binding[] = [
    createBindingFromClass(OpenApiVersionEnhancer, {
      key: `${OASEnhancerBindings.OAS_ENHANCER_SERVICE}.openapi-version`,
    }),
  ];

  constructor(
    @config({optional: true})
    private options: OpenApiVersionConfig = DEFAULT_CONFIG,
  ) {}
}
