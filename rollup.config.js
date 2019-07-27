import babel from 'rollup-plugin-babel'
import {terser} from 'rollup-plugin-terser'

export default {
    input: './lib/index.js',
    plugins: [
        babel(),
        terser()
    ],
    output: {
        file: './dist/superouter.min.js',
        format: 'umd',
        name: 'superouter',
        sourcemap: 'external'
    },

}
