import {terser} from 'rollup-plugin-terser'


export default [
    {
        input: './lib/index.js'
        ,output: {
            file: './dist/superouter.umd.js'
            ,format: 'umd'
            ,name: 'superouter'
            ,sourcemap: 'external'
        },
    
    }
    ,{
        input: './lib/index.js'
        ,output: {
            file: './dist/superouter.cjs'
            ,format: 'cjs'
            ,name: 'superouter'
            ,sourcemap: 'external'
        },
    
    }
    ,{
        input: './lib/index.js'
        ,plugins: [
            terser()
        ]
        ,output: {
            file: './dist/superouter.umd.min.js'
            ,format: 'umd'
            ,name: 'superouter'
            ,sourcemap: 'external'
        },
    }
    ,{
        input: './lib/index.js'
        ,output: {
            file: './dist/superouter.esm.js'
            ,format: 'esm'
            ,sourcemap: 'external'
        },
    }
    ,{
        input: './lib/index.js'
        ,plugins: [
            terser()
        ]
        ,output: {
            file: './dist/superouter.esm.min.js'
            ,format: 'esm'
            ,sourcemap: 'external'
        },
    }
]