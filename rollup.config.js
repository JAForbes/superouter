
import {terser} from 'rollup-plugin-terser'

export default {
    input: './lib/index.js'
    ,plugins: [
        terser()
    ]
    ,output: {
        file: './dist/superouter.min.js'
        ,format: 'umd'
        ,name: 'superouter'
        ,sourcemap: 'external'
    },

}
