import {describe, it, expect} from 'vitest';
import {OpenApiVersionEnhancer} from '../openapi-version.enhancer';
import {OpenApiSpec} from '@loopback/openapi-v3';

function createTestSpec(): OpenApiSpec {
  return {
    openapi: '3.0.0',
    info: {title: 'Test', version: '1.0.0'},
    paths: {
      '/items': {
        get: {
          operationId: 'getItems',
          parameters: [
            {
              name: 'filter',
              in: 'query',
              schema: {type: 'string', nullable: true},
            },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {type: 'integer'},
                        name: {type: 'string', nullable: true},
                        tags: {
                          type: 'array',
                          items: {type: 'string', nullable: true},
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createItem',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: {type: 'string'},
                    description: {type: 'string', nullable: true},
                  },
                },
              },
            },
          },
          responses: {
            '200': {description: 'Created'},
          },
        },
      },
    },
    components: {
      schemas: {
        Item: {
          type: 'object',
          properties: {
            id: {type: 'integer'},
            name: {type: 'string'},
            notes: {type: 'string', nullable: true},
            metadata: {
              type: 'object',
              nullable: true,
              additionalProperties: {type: 'string'},
            },
          },
        },
      },
    },
    tags: [{name: 'items', description: 'Item operations'}],
  };
}

function createSpec32(): Record<string, unknown> {
  return {
    openapi: '3.2.0',
    info: {title: 'Test', version: '1.0.0'},
    $self: 'https://api.example.com/openapi.json',
    paths: {
      '/items': {
        get: {
          operationId: 'getItems',
          parameters: [
            {
              name: 'qs',
              in: 'querystring',
              schema: {type: 'string'},
            },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'text/event-stream': {
                  schema: {type: 'string'},
                  itemSchema: {
                    type: 'object',
                    properties: {
                      id: {type: 'integer'},
                    },
                  },
                },
              },
            },
          },
        },
        query: {
          operationId: 'queryItems',
          responses: {'200': {description: 'OK'}},
        },
        additionalOperations: {
          PURGE: {
            operationId: 'purgeItems',
            responses: {'200': {description: 'Purged'}},
          },
        },
      },
    },
    components: {
      schemas: {
        Item: {
          type: 'object',
          properties: {
            id: {type: 'integer'},
            name: {type: ['string', 'null']},
          },
        },
      },
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://auth.example.com/authorize',
              tokenUrl: 'https://auth.example.com/token',
              scopes: {read: 'Read access'},
            },
            device: {
              tokenUrl: 'https://auth.example.com/device',
              scopes: {read: 'Read access'},
            },
          },
        },
      },
      examples: {
        ItemExample: {
          summary: 'An item',
          dataValue: {id: 1, name: 'Test'},
          serializedValue: '{"id":1,"name":"Test"}',
        },
      },
    },
    tags: [
      {
        name: 'items',
        summary: 'Item endpoints',
        parent: 'resources',
        kind: 'nav',
      },
    ],
  };
}

// -------------------------------------------------------------------
// 3.0 -> 3.0 (no-op)
// -------------------------------------------------------------------

describe('OpenApiVersionEnhancer', () => {
  describe('version 3.0.0 (no-op)', () => {
    it('returns spec unchanged', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const spec = createTestSpec();
      const result = enhancer.modifySpec(spec);
      expect(result.openapi).toBe('3.0.0');
    });

    it('preserves nullable in 3.0 mode', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const notes = props?.notes as Record<string, unknown>;
      expect(notes?.nullable).toBe(true);
      expect(notes?.type).toBe('string');
    });
  });

  // -------------------------------------------------------------------
  // 3.0 -> 3.1 upgrades
  // -------------------------------------------------------------------

  describe('version 3.1.0', () => {
    it('updates the openapi version field', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.1.0');
    });

    it('transforms nullable in component schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const notes = props?.notes as Record<string, unknown>;
      expect(notes?.type).toEqual(['string', 'null']);
      expect(notes).not.toHaveProperty('nullable');
    });

    it('transforms nullable in nested object schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const metadata = props?.metadata as Record<string, unknown>;
      expect(metadata?.type).toEqual(['object', 'null']);
      expect(metadata).not.toHaveProperty('nullable');
    });

    it('transforms nullable in response schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const getOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.get as Record<string, unknown>;
      const resp = (getOp?.responses as Record<string, unknown>)?.[
        '200'
      ] as Record<string, unknown>;
      const content = resp?.content as Record<string, unknown>;
      const json = content?.['application/json'] as Record<string, unknown>;
      const schema = json?.schema as Record<string, unknown>;
      const items = schema?.items as Record<string, unknown>;
      const props = items?.properties as Record<string, unknown>;
      const name = props?.name as Record<string, unknown>;
      expect(name?.type).toEqual(['string', 'null']);
      expect(name).not.toHaveProperty('nullable');
    });

    it('transforms nullable in deeply nested array items', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const getOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.get as Record<string, unknown>;
      const resp = (getOp?.responses as Record<string, unknown>)?.[
        '200'
      ] as Record<string, unknown>;
      const content = resp?.content as Record<string, unknown>;
      const json = content?.['application/json'] as Record<string, unknown>;
      const schema = json?.schema as Record<string, unknown>;
      const items = schema?.items as Record<string, unknown>;
      const props = items?.properties as Record<string, unknown>;
      const tags = props?.tags as Record<string, unknown>;
      const tagItems = tags?.items as Record<string, unknown>;
      expect(tagItems?.type).toEqual(['string', 'null']);
    });

    it('transforms nullable in request body schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const postOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.post as Record<string, unknown>;
      const reqBody = postOp?.requestBody as Record<string, unknown>;
      const content = reqBody?.content as Record<string, unknown>;
      const json = content?.['application/json'] as Record<string, unknown>;
      const schema = json?.schema as Record<string, unknown>;
      const props = schema?.properties as Record<string, unknown>;
      const desc = props?.description as Record<string, unknown>;
      expect(desc?.type).toEqual(['string', 'null']);
      expect(desc).not.toHaveProperty('nullable');
    });

    it('transforms nullable in parameter schemas', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const getOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.get as Record<string, unknown>;
      const params = getOp?.parameters as Record<string, unknown>[];
      const param = params?.[0];
      const schema = param?.schema as Record<string, unknown>;
      expect(schema?.type).toEqual(['string', 'null']);
      expect(schema).not.toHaveProperty('nullable');
    });

    it('skips transform when transformNullable is false', () => {
      const enhancer = new OpenApiVersionEnhancer({
        version: '3.1.0',
        transformNullable: false,
      });
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.1.0');
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const notes = props?.notes as Record<string, unknown>;
      expect(notes?.nullable).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // 3.0 -> 3.2
  // -------------------------------------------------------------------

  describe('version 3.2.0', () => {
    it('updates the openapi version field', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.2.0'});
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.2.0');
    });

    it('transforms nullable schemas same as 3.1', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.2.0'});
      const result = enhancer.modifySpec(createTestSpec());
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const notes = props?.notes as Record<string, unknown>;
      expect(notes?.type).toEqual(['string', 'null']);
    });
  });

  // -------------------------------------------------------------------
  // 3.2 -> 3.0 downgrade (strip 3.2 features)
  // -------------------------------------------------------------------

  describe('3.2 -> 3.0 downgrade', () => {
    it('strips $self from root', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      expect(result).not.toHaveProperty('$self');
    });

    it('strips query method from paths', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const pathItem = result.paths?.['/items'] as Record<string, unknown>;
      expect(pathItem).not.toHaveProperty('query');
    });

    it('strips additionalOperations from paths', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const pathItem = result.paths?.['/items'] as Record<string, unknown>;
      expect(pathItem).not.toHaveProperty('additionalOperations');
    });

    it('strips tag summary, parent, kind', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const tag = result.tags?.[0] as Record<string, unknown>;
      expect(tag?.name).toBe('items');
      expect(tag).not.toHaveProperty('summary');
      expect(tag).not.toHaveProperty('parent');
      expect(tag).not.toHaveProperty('kind');
    });

    it('strips OAuth2 device flow', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const schemes = result.components?.securitySchemes as Record<
        string,
        unknown
      >;
      const oauth2 = schemes?.oauth2 as Record<string, unknown>;
      const flows = oauth2?.flows as Record<string, unknown>;
      expect(flows).not.toHaveProperty('device');
      expect(flows).toHaveProperty('authorizationCode');
    });

    it('strips itemSchema from media types', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const getOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.get as Record<string, unknown>;
      const resp = (getOp?.responses as Record<string, unknown>)?.[
        '200'
      ] as Record<string, unknown>;
      const content = resp?.content as Record<string, unknown>;
      const sse = content?.['text/event-stream'] as Record<string, unknown>;
      expect(sse).not.toHaveProperty('itemSchema');
      expect(sse).toHaveProperty('schema');
    });

    it('strips dataValue and serializedValue from examples', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const examples = result.components?.examples as Record<string, unknown>;
      const item = examples?.ItemExample as Record<string, unknown>;
      expect(item).not.toHaveProperty('dataValue');
      expect(item).not.toHaveProperty('serializedValue');
      expect(item?.summary).toBe('An item');
    });

    it('converts querystring parameter location to query', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const getOp = (result.paths?.['/items'] as Record<string, unknown>)
        ?.get as Record<string, unknown>;
      const params = getOp?.parameters as Record<string, unknown>[];
      expect(params?.[0]?.in).toBe('query');
    });

    it('reverts type arrays to nullable for 3.0', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.0.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const name = props?.name as Record<string, unknown>;
      expect(name?.type).toBe('string');
      expect(name?.nullable).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // 3.2 -> 3.1 downgrade (strip 3.2 features, keep 3.1 features)
  // -------------------------------------------------------------------

  describe('3.2 -> 3.1 downgrade', () => {
    it('strips 3.2 features but keeps type arrays', () => {
      const enhancer = new OpenApiVersionEnhancer({version: '3.1.0'});
      const result = enhancer.modifySpec(createSpec32() as OpenApiSpec);
      expect(result.openapi).toBe('3.1.0');

      // 3.2 features stripped
      const pathItem = result.paths?.['/items'] as Record<string, unknown>;
      expect(pathItem).not.toHaveProperty('query');
      expect(result).not.toHaveProperty('$self');

      // 3.1 features preserved (type arrays stay)
      const item = result.components?.schemas?.Item as Record<string, unknown>;
      const props = item?.properties as Record<string, unknown>;
      const name = props?.name as Record<string, unknown>;
      expect(name?.type).toEqual(['string', 'null']);
      expect(name).not.toHaveProperty('nullable');
    });
  });

  // -------------------------------------------------------------------
  // Default config
  // -------------------------------------------------------------------

  describe('default config', () => {
    it('defaults to 3.0.0 (no-op)', () => {
      const enhancer = new OpenApiVersionEnhancer();
      const result = enhancer.modifySpec(createTestSpec());
      expect(result.openapi).toBe('3.0.0');
    });
  });
});
