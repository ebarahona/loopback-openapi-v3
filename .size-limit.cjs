// Package size budget. This is a Node-only library, so esbuild bundles for
// the Node platform: built-ins stay external. Runtime and peer dependencies
// are ignored so the budget tracks this package's own code.
/** @type {import('size-limit').SizeLimitConfig} */
module.exports = [
  {
    name: 'dist (CommonJS)',
    path: 'dist/index.js',
    limit: '10 KB',
    ignore: [
      '@loopback/core',
      '@loopback/openapi-v3',
      '@loopback/rest',
      'debug',
      'openapi3-ts',
    ],
  },
].map(entry => ({
  ...entry,
  modifyEsbuildConfig: config => ({...config, platform: 'node'}),
}));
