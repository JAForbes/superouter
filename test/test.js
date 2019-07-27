const test = require('tape')

const { 
    tokenizePattern, 
    tokenizeURL, 
    URLToken,
    type$safe,
    type
} = require('../lib')

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
                'VariadicPosition|VariadicCount|DuplicatePart',
                'Validation detects multiple variadics'
            )
        }
    }

    t.end()
})

test('tokenizeURL', t => {
    const patternTokens = tokenizePattern(':a/:b/staticPart/:d/...f')

    t.comment('Valid URL'); {
    
        const url = 'wow/such/staticPart/stuff/that/is/good/'
    
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

    t.comment('extract args out of token with toArgs'); {

        const toArgsAssert =
            [
                [URLToken.ExcessSegment('hi'), {}]
                ,[URLToken.Path('wow'), {}]
                ,[URLToken.Part({ key: 'a', value: 'b' }), { a: 'b' }]
                ,[URLToken.Unmatched({ expected: 'this', actual: 'that' }), {}]
                ,[URLToken.Variadic({ key: 'c', value: 'd' }), { c: 'd' }]
            ]
            .map(
                ([a,b]) => [URLToken.toArgs([a]), b]
            )
            .map(
                xs => xs.map( x => JSON.stringify(x) )
            )
            .filter(
                ([a,b]) => a !== b
            )
            .map(
                ([a,b]) => a+'<>'+b
            )
            .join('|')

        t.equals(
            toArgsAssert
            , ''
            , 'toArgs can extract args for applicable tokens'
        )
    }

    t.end()
})

test('type', t => {
    t.comment('ValidRoute'); {
        const Route = type('Route', {
            Home: '/'
            ,Post: '/post/:post'
            ,Settings: '/settings/...settingsRoute'
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

        t.throws(
            () => Route.of.Home({ too: 1, many: 2 })
            ,/Property mismatch for Route/u
            ,'Route case constructor throws if there are errors'
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
            Route.of.Settings({ settingsRoute: '1/2/3'}).value.settingsRoute,
            '1/2/3',
            'Route constructor matches input pattern and args'
        )
    }

    t.comment('Invalid Route'); {

        const def = {
            Post: '/post/:post'
            ,DuplicateDef: '/post/:post'
            ,DuplicatePart: '/post/:a/:a'
            ,WeirdVar: '/...weird/:var'
            ,TooMany: '/...weird/...weird'
        }

        const VRoute = type$safe('Route', def)

        t.throws(
            () => type('Route', def)
            ,/Found duplicate pattern definitions/u
            ,'Route constructor throws if patterns have errors'
        )

        t.equals(VRoute.case, 'N', 'Invalid Route definitions reported')

        t.equals(
            VRoute.value.WeirdVar.filter( x => x.case === 'VariadicPosition' )
                .map( x => x.case ).shift()
            ,'VariadicPosition'
            ,'Route with incorrect Variadic position reported'
        )

        t.equals(
            VRoute.value.TooMany.filter( x => x.case === 'VariadicCount' )
                .map( x => x.case )
                .shift()
            ,'VariadicCount'
            ,'Route with incorrect number of variadics reported'
        )

        t.equals(
            [].concat(
                VRoute.value
                    .DuplicateDef.filter( x => x.case === 'DuplicateDef')
                ,VRoute.value
                    .Post.filter( x => x.case === 'DuplicateDef')
            )
                .map( x => x.case )
                .join('|')
            ,'DuplicateDef|DuplicateDef'
            ,'Route with multiple defintions with the same tokens reported'
        )

        t.equals(
            VRoute.value.DuplicatePart.filter( x => x.case === 'DuplicatePart')
                .map( x => x.case )
                .shift()
            ,'DuplicatePart'
            ,'Route with repeated variable bindings reported'
        )
    }
    t.comment('Route.matchOr'); {
        const Route = type('Route', {
            Home: '/'
            ,Settings: '/settings/:settings'
            ,Album: '/album/:album_id'
            ,AlbumPhoto: '/album/:album_id/photo/:file_id'
            ,Tag: '/tag/:tag'
            ,TagFile: '/tag/:tag/photo/:file_id'
        })

        t.equals(
            'AlbumPhoto|abc123|123',
            [Route.matchOr( 
                () => Route.of.Home(),
                '/album/abc123/photo/123'
            )]
            .flatMap(
                x =>  [x.case, x.value.album_id, x.value.file_id]
            )
            .join('|'),
            'matchOr instantiates the correct Route with data from the url'
        )

        
        t.equals(
            'ExcessSegment',
            [Route.matchOr( 
                err => err,
                '/album/abc123/photo/123/other'
            )]
            .flatMap( x => x.AlbumPhoto )
            .map(
                x => x.case
            )
            .join('|'),
            'matchOr returns the errors that prevented a match'
        )

        const view =
            Route.fold({
                Home: () => '/'
                ,Settings: ({ settings }) => 
                    '/settings/:'+settings
                ,Album: ({ album_id }) => 
                    '/album/'+album_id
                ,AlbumPhoto: ({ album_id, file_id}) => 
                    '/album/'+album_id+'/photo/'+file_id
                ,Tag: ({ tag }) => '/tag/'+tag
                ,TagFile: ({ tag, file_id }) => '/tag/'+tag+'/photo/'+file_id
            })

        t.equals(
            '/album/abc123/photo/123',
            [Route.matchOr( 
                () => Route.of.Home(),
                '/album/abc123/photo/123'
            )
            ]
            .map(view)
            .shift(),
            'matchOr matches valid patterns'
        )
    }

    t.comment('Route.toURL'); {
        const Route = type('Route', {
            Home: '/'
            ,Settings: '/settings/:settings'
            ,Album: '/album/:album_id'
            ,AlbumPhoto: '/album/:album_id/photo/:file_id'
            ,Tag: '/tag/:tag'
            ,TagFile: '/tag/:tag/photo/:file_id/...rest'
        })

        t.equals(
            Route.toURL(
                Route.of.TagFile({ tag:'beach', file_id: 123, rest: 'a/b/c' })
            ),
            '/tag/beach/photo/123/a/b/c',
            'toURL recreates a URL that could have instantiated a route'
        )
    }

    t.comment('Multiple valid matches sorted by specificity'); {
        const Route = type('Route', {
            Edit: '/account/:account_id'
            ,Create: '/account/create'
            ,Variadic: '/account/:account_id/...rest'
            ,Precise: '/account/:account_id/:precise'
        })

        t.equals(
            Route.matches(
                '/account/create'
            )
            .value.map( x => x.case ).join('|'),
            'Create|Edit|Variadic',
            'Route matches returned in order of specificity (Part/Path)'
        )

        
        t.equals(
            Route.matches(
                '/account/123/update'
            )
            .value.map( x => x.case ).join('|'),
            'Precise|Variadic',
            'Route matches returned in order of specificity (Part/Variadic)'
        )
    }

    t.end()
})

test('Router is compatible with static-sum-type', t => {
    const Route = type('Route', {
      Edit: '/account/:account_id'
      ,Create: '/account/create'
      ,Variadic: '/account/:account_id/...rest'
      ,Precise: '/account/:account_id/:precise'
    })
  
    const instance = Route.of.Precise({ account_id: 1, precise: 2 })
  
    t.equals(
        Route.of.name
        , 'Route'
        , 'constructor has expected name property'
    )
    
    t.equals(
      instance.type
      , Route.of.name
      , 'instance has a type property matching the constructor'
    )
  
    t.equals(
      instance.case
      , 'Precise'
      , 'instance has expected case property'
    )
  
    t.end()
})


test('trailing slahes', t => {
    const Route = type('Route', {
        Account: '/account/...rest'
    })

    const a = Route.matches('/account/1/')
    const b = Route.matches('/account/1')
    const c = Route.matches('/account')
    const d = Route.matches('/account/')
    const e = Route.matches('/account/1/2/3')

    const allMatch =
        [a,b,c,d,e]
        .filter( x => x.case === 'Y' )
        .flatMap( x => x.value )
        .map( x => x.case )
        .join('|')

    t.equals(
        [a,b,c,d,e].map( () => 'Account').join('|'),
        allMatch,
        '/...rest matches without a trailing slash'
    )
    
    t.end()
})
