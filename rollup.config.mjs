import swc from '@rollup/plugin-swc'
import resolve from '@rollup/plugin-node-resolve'

export default [
    {
        input: './lib/index.ts',
        output: {
            file: './dist/superouter.esm.js',
            format: 'esm',
            sourcemap: 'external',
        },
        plugins: [
            resolve({
                extensions: ['.js', '.ts']
            }),
            swc(),
        ]
    }
]