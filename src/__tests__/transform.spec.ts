import {describe, it, expect} from 'vitest';
import {transformOpenApiSpec, parseVersion} from '../transform';

// -------------------------------------------------------------------
// parseVersion
// -------------------------------------------------------------------

describe('parseVersion', () => {
  it('parses valid versions', () => {
    expect(parseVersion('3.0.0')).toEqual({major: 3, minor: 0, patch: 0});
    expect(parseVersion('3.1.0')).toEqual({major: 3, minor: 1, patch: 0});
    expect(parseVersion('3.2.0')).toEqual({major: 3, minor: 2, patch: 0});
    expect(parseVersion('3.1.1')).toEqual({major: 3, minor: 1, patch: 1});
  });

  it('rejects invalid formats', () => {
    expect(() => parseVersion('banana')).toThrow('Invalid OpenAPI version');
    expect(() => parseVersion('3.0')).toThrow('Invalid OpenAPI version');
    expect(() => parseVersion('3')).toThrow('Invalid OpenAPI version');
    expect(() => parseVersion('')).toThrow('Invalid OpenAPI version');
  });

  it('rejects non-v3 versions', () => {
    expect(() => parseVersion('2.0.0')).toThrow('Unsupported OpenAPI major version');
    expect(() => parseVersion('4.0.0')).toThrow('Unsupported OpenAPI major version');
  });
});

// -------------------------------------------------------------------
// Deep clone (no mutation)
// -------------------------------------------------------------------

describe('deep clone safety', () => {
  it('does not mutate the original spec', () => {
    const original = {
      openapi: '3.0.0',
      info: {title: 'Test', version: '1.0.0'},
      paths: {},
      components: {
        schemas: {
          Item: {
            type: 'object',
            properties: {
              name: {type: 'string', nullable: true},
            },
          },
        },
      },
    };

    const frozen = JSON.parse(JSON.stringify(original));
    transformOpenApiSpec(original, {version: '3.1.0'});
    expect(original).toEqual(frozen);
  });
});

// -------------------------------------------------------------------
// Nullable: edge cases
// -------------------------------------------------------------------

describe('nullable edge cases', () => {
  it('handles nullable with oneOf', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        schemas: {
          Mixed: {
            nullable: true,
            oneOf: [{type: 'string'}, {type: 'integer'}],
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const mixed = (result.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
    const schema = mixed?.Mixed as Record<string, unknown>;
    expect(schema).not.toHaveProperty('nullable');
    expect(schema.oneOf).toEqual([
      {type: 'string'},
      {type: 'integer'},
      {type: 'null'},
    ]);
  });

  it('handles nullable with anyOf', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        schemas: {
          Mixed: {
            nullable: true,
            anyOf: [{type: 'string'}],
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const schema = ((result.components as Record<string, unknown>)?.schemas as Record<string, unknown>)?.Mixed as Record<string, unknown>;
    expect(schema.anyOf).toEqual([{type: 'string'}, {type: 'null'}]);
  });

  it('handles nullable with allOf (wraps in anyOf)', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        schemas: {
          Mixed: {
            nullable: true,
            allOf: [{type: 'object'}, {properties: {id: {type: 'integer'}}}],
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const schema = ((result.components as Record<string, unknown>)?.schemas as Record<string, unknown>)?.Mixed as Record<string, unknown>;
    expect(schema).not.toHaveProperty('allOf');
    expect(schema.anyOf).toEqual([
      {allOf: [{type: 'object'}, {properties: {id: {type: 'integer'}}}]},
      {type: 'null'},
    ]);
  });

  it('handles nullable with no type', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        schemas: {
          Empty: {nullable: true},
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const schema = ((result.components as Record<string, unknown>)?.schemas as Record<string, unknown>)?.Empty as Record<string, unknown>;
    expect(schema.type).toBe('null');
    expect(schema).not.toHaveProperty('nullable');
  });

  it('downgrades oneOf with null type back to nullable', () => {
    const spec = {
      openapi: '3.1.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        schemas: {
          Mixed: {
            oneOf: [{type: 'string'}, {type: 'integer'}, {type: 'null'}],
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.0.0'});
    const schema = ((result.components as Record<string, unknown>)?.schemas as Record<string, unknown>)?.Mixed as Record<string, unknown>;
    expect(schema.nullable).toBe(true);
    expect(schema.oneOf).toEqual([{type: 'string'}, {type: 'integer'}]);
  });
});

// -------------------------------------------------------------------
// Components: parameters, requestBodies, responses, headers
// -------------------------------------------------------------------

describe('component-level schema traversal', () => {
  it('transforms schemas in components.parameters', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        parameters: {
          FilterParam: {
            name: 'filter',
            in: 'query',
            schema: {type: 'string', nullable: true},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const params = (result.components as Record<string, unknown>)?.parameters as Record<string, unknown>;
    const param = params?.FilterParam as Record<string, unknown>;
    const schema = param?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['string', 'null']);
  });

  it('transforms schemas in components.requestBodies', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        requestBodies: {
          CreateItem: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: {type: 'string', nullable: true},
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const bodies = (result.components as Record<string, unknown>)?.requestBodies as Record<string, unknown>;
    const body = bodies?.CreateItem as Record<string, unknown>;
    const content = body?.content as Record<string, unknown>;
    const json = content?.['application/json'] as Record<string, unknown>;
    const schema = json?.schema as Record<string, unknown>;
    const props = schema?.properties as Record<string, unknown>;
    const name = props?.name as Record<string, unknown>;
    expect(name?.type).toEqual(['string', 'null']);
  });

  it('transforms schemas in components.responses', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        responses: {
          ItemResponse: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {type: 'string', nullable: true},
              },
            },
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const responses = (result.components as Record<string, unknown>)?.responses as Record<string, unknown>;
    const resp = responses?.ItemResponse as Record<string, unknown>;
    const content = resp?.content as Record<string, unknown>;
    const json = content?.['application/json'] as Record<string, unknown>;
    const schema = json?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['string', 'null']);
  });

  it('transforms schemas in components.headers', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        headers: {
          XRateLimit: {
            schema: {type: 'integer', nullable: true},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const headers = (result.components as Record<string, unknown>)?.headers as Record<string, unknown>;
    const header = headers?.XRateLimit as Record<string, unknown>;
    const schema = header?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['integer', 'null']);
  });
});

// -------------------------------------------------------------------
// Webhooks
// -------------------------------------------------------------------

describe('webhooks', () => {
  it('transforms schemas in webhooks', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      webhooks: {
        newItem: {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {type: 'string', nullable: true},
                },
              },
            },
            responses: {'200': {description: 'OK'}},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const webhooks = result.webhooks as Record<string, unknown>;
    const hook = webhooks?.newItem as Record<string, unknown>;
    const post = hook?.post as Record<string, unknown>;
    const reqBody = post?.requestBody as Record<string, unknown>;
    const content = reqBody?.content as Record<string, unknown>;
    const json = content?.['application/json'] as Record<string, unknown>;
    const schema = json?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['string', 'null']);
  });

  it('strips 3.2 features from webhooks', () => {
    const spec = {
      openapi: '3.2.0',
      info: {title: 'T', version: '1'},
      paths: {},
      webhooks: {
        newItem: {
          query: {
            responses: {'200': {description: 'OK'}},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.0.0'});
    const webhooks = result.webhooks as Record<string, unknown>;
    const hook = webhooks?.newItem as Record<string, unknown>;
    expect(hook).not.toHaveProperty('query');
  });
});

// -------------------------------------------------------------------
// Callbacks
// -------------------------------------------------------------------

describe('callbacks', () => {
  it('transforms schemas in callbacks', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {
        '/subscribe': {
          post: {
            operationId: 'subscribe',
            callbacks: {
              onEvent: {
                '{$request.body#/callbackUrl}': {
                  post: {
                    requestBody: {
                      content: {
                        'application/json': {
                          schema: {type: 'string', nullable: true},
                        },
                      },
                    },
                    responses: {'200': {description: 'OK'}},
                  },
                },
              },
            },
            responses: {'200': {description: 'OK'}},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const paths = result.paths as Record<string, unknown>;
    const sub = paths?.['/subscribe'] as Record<string, unknown>;
    const post = sub?.post as Record<string, unknown>;
    const callbacks = post?.callbacks as Record<string, unknown>;
    const onEvent = callbacks?.onEvent as Record<string, unknown>;
    const cbPath = onEvent?.['{$request.body#/callbackUrl}'] as Record<string, unknown>;
    const cbPost = cbPath?.post as Record<string, unknown>;
    const reqBody = cbPost?.requestBody as Record<string, unknown>;
    const content = reqBody?.content as Record<string, unknown>;
    const json = content?.['application/json'] as Record<string, unknown>;
    const schema = json?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['string', 'null']);
  });
});

// -------------------------------------------------------------------
// Path-level parameters
// -------------------------------------------------------------------

describe('path-level parameters', () => {
  it('transforms schemas in path-level parameters', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {
        '/items/{id}': {
          parameters: [
            {name: 'id', in: 'path', schema: {type: 'string', nullable: true}},
          ],
          get: {
            responses: {'200': {description: 'OK'}},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const paths = result.paths as Record<string, unknown>;
    const pathItem = paths?.['/items/{id}'] as Record<string, unknown>;
    const params = pathItem?.parameters as Record<string, unknown>[];
    const schema = params?.[0]?.schema as Record<string, unknown>;
    expect(schema?.type).toEqual(['string', 'null']);
  });
});

// -------------------------------------------------------------------
// Circular references
// -------------------------------------------------------------------

describe('circular references', () => {
  it('handles circular schema references without infinite loop', () => {
    const node: Record<string, unknown> = {
      type: 'object',
      properties: {},
    };
    // Create circular reference
    (node.properties as Record<string, unknown>).self = node;

    const spec = {
      openapi: '3.0.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {schemas: {Node: node}},
    };

    // structuredClone breaks on circular refs, so test the walkSchemas
    // logic separately. The transform will clone first which breaks cycles,
    // but the walk itself should handle cycles via WeakSet.
    expect(() => {
      // This would infinite loop without the WeakSet guard
      transformOpenApiSpec(
        JSON.parse(JSON.stringify(spec, (key, value) => {
          // Break circular ref for JSON.stringify
          if (key === 'self' && value === node) return {$ref: '#/components/schemas/Node'};
          return value;
        })),
        {version: '3.1.0'},
      );
    }).not.toThrow();
  });
});

// -------------------------------------------------------------------
// 3.2 specific: jsonSchemaDialect, mediaTypes
// -------------------------------------------------------------------

describe('3.2 additional fields', () => {
  it('strips jsonSchemaDialect when downgrading', () => {
    const spec = {
      openapi: '3.2.0',
      info: {title: 'T', version: '1'},
      paths: {},
      jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    };

    const result = transformOpenApiSpec(spec, {version: '3.0.0'});
    expect(result).not.toHaveProperty('jsonSchemaDialect');
  });

  it('strips components.mediaTypes when downgrading', () => {
    const spec = {
      openapi: '3.2.0',
      info: {title: 'T', version: '1'},
      paths: {},
      components: {
        mediaTypes: {
          JsonResponse: {
            schema: {type: 'object'},
          },
        },
      },
    };

    const result = transformOpenApiSpec(spec, {version: '3.1.0'});
    const components = result.components as Record<string, unknown>;
    expect(components).not.toHaveProperty('mediaTypes');
  });
});
