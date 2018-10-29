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

test('tokenizeURL', t => {
    const patternTokens = tokenizePattern(':a/:b/staticPart/:d/...f')

    t.comment('Valid URL'); {
    
        const url = 'wow/such/staticPart/stuff/that/is/good'
    
        const out = 
            tokenizeURL(
                patternTokens.value,
                url
            )
    
        t.equals(
            out.case,
            'Y',
            'The tokenizer can handle all PatternToken types'
        )
    
        const cases = 
            out.value.map( x => x.case ).join('|')
    
        t.equals(
            'Part|Part|Path|Part|Variadic', 
            cases, 
            'tokenizeURL specified the correct URLToken types'
        )
    
        t.equals(
            URLToken.toURL(out.value),
            url,
            'URLToken can recreate the input URL'
        )
    }

    t.comment('Invalid URL: Unmatched Paths'); {
        const noStaticPart = 'wow/such/stuff/that/is/good'

        const out = 
            tokenizeURL(
                patternTokens.value,
                noStaticPart
            )

        t.equals(out.case, 'N', 'Invalid static match detected')

        t.equals(
            out.value.map( x => x.case ).join('|')
            ,'UnmatchedPaths'
        )
    }

    
    t.comment('Invalid URL: ExcessSegments'); {
        const url = 'a/b/:c'
        const excessSegments = 'a/b/c/d'

        const out = 
            tokenizeURL(
                tokenizePattern(url).value,
                excessSegments
            )

        t.equals(out.case, 'N', 'Invalid static match detected')

        t.equals(
            out.value.map( x => x.case ).join('|')
            ,'ExcessSegment'
        )
    }

    t.comment('Invalid URL: ExcessPatterns'); {
        const url = 'a/b/c/:d'
        const excessSegments = 'a/b/c'

        const out = 
            tokenizeURL(
                tokenizePattern(url).value,
                excessSegments
            )

        t.equals(out.case, 'N', 'Invalid static match detected')

        t.equals(
            out.value.map( x => x.case ).join('|')
            ,'ExcessPattern'
        )
    }

    t.end()
})

test('type', t => {
    t.comment('ValidRoute'); {
        const Route = type('Route', {
            Home: '/',
            Post: '/post/:post',
            Settings: '/settings/...settingsRoute'
        })


        t.equals( 
            Route.safe.Home().case
            , 'Y'
            , 'Empty pattern can be created without args' 
        )

        t.equals( 
            Route.safe.Home({ too: 1, many: 2 }).case
            , 'N'
            , 'Empty pattern cannot be created with args' 
        )

        t.equals(
            Route.safe.Post().case
            , 'N'
            , 'Arg pattern cannot be created without args'
        )

        
        t.equals(
            Route.safe.Settings({ wrong: 1, or: 1, missing: 1}).case
            , 'N'
            , 'Arg pattern cannot be created with wrong or missing args'
        )

        t.equals(
            Route.Settings({ settingsRoute: '1/2/3'}).value.settingsRoute,
            '1/2/3',
            'Route constructor matches input pattern and args'
        )

        console.log(
            Route.matchesOr(
                x => x, '/post/yes/wow'
            )
        )
    }

    t.end()
})