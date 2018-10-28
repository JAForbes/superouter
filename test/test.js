const test = require('tape')

const { 
    tokenizePattern, 
    tokenizeURL, 
    URLToken, 
    PatternToken, 
    Valid,
    type 
} = require('../lib')


// const routes = {
//     '/': () => 'home',
//     '/posts/:post': ({ post }) => ({ post }),
//     '/about': () => 'about',
//     '/a/:b/c/:d': () => 'yes'
// }


// const urls = [
//     '/', '/posts/hi-there', '/nomatch/.exe', '/about', '/a/1/c/2'
// ]

// {
//     const pattern = 'posts/:post/...rest'
//     const url = 'posts/hi-there/2/3'
//     const patternTokens = 
//         tokenizePattern(pattern)

//     const urlTokens =
//         patternTokens.case === 'Y'
//         ? tokenizeURL(patternTokens.value, url)
//         : []

//     console.log({
//         patternTokens, urlTokens
//     })


// }

test('tokenizePatterns', t => {

    t.comment('Valid simple pattern'); {
        const input = 'a/b/c/d'
        const output = tokenizePattern(input)

        t.equals(output.case, 'Y', 'output is valid')
        t.equals(
            output.value.length, 
            input.split('/').length, 
            'n tokens = n segments'
        )

        t.equals( 
            output.value.map( x => x.value ).join('/'),
            input,
            'The output\'s values match the input\'s split'
        )

        t.equals(
            output.value.map( x => x.type+'.'+x.case ).join('|'),
            input.split('/').map( () => 'PatternToken.Path' ).join('|'),
            'The cases are all PatternToken.Path'
        )
    }

    t.comment('Valid complex pattern'); {
        const input = 'a/:b/c/...d'
        const output = tokenizePattern(input)

        t.equals(output.case, 'Y', 'output is valid')
        
        t.equals(
            output.value.map( x => x.case ).join('/'),
            'Path/Part/Path/Variadic',
            'The output are of the correct case types'
        )

    }

    t.comment('Invalid patterns'); {
        {
            const input = '...rest/something/:wow'

            const output = tokenizePattern(input)

            t.equals(
                output.value.map( x => x.case).join('|'), 
                'VariadicPosition',
                'Validation detects variadic in incorrect position'
            )
        }

        {
            const input = '...rest/...rest/something/:wow'

            const output = tokenizePattern(input)

            t.equals(
                output.value.map( x => x.case).join('|'), 
                'VariadicPosition|VariadicCount',
                'Validation detects multiple variadics'
            )
        }
    }

    t.end()
})