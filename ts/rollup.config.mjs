import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const input = './src/index.ts';
const plugins = [
  resolve(),
  typescript({
    tsconfig: './tsconfig.build.json',
  }),
];

export default {
  input,
  output: [
    {
      file: './dist/point-within-polygon.js',
      format: 'umd',
      name: 'pointWithinPolygon',
      exports: 'default',
      sourcemap: true,
    },
    {
      file: './dist/point-within-polygon.mjs',
      format: 'es',
      sourcemap: true,
    },
    {
      file: './dist/point-within-polygon.cjs',
      format: 'cjs',
      exports: 'default',
      sourcemap: true,
    },
  ],
  plugins,
};
