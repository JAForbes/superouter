const Valid = {
    name: 'Valid',
    Y: value => ({ case: 'Y', type: 'Valid', value}),
    N: value => ({ case: 'N', type: 'Valid', value}),
    bifold: (N,Y) => o => ({
        Y,
        N
    })[o.case](o.value),
    fold: ({ Y,N }) => o => ({ Y,N })[o.case](o.value),
    map: f => o => ({
        Y: x => Valid.Y(f(x)),
        N: () => o
    })[o.case](o.value)
}

const PatternToken = {
    name: 'PatternToken',
    Path: value =>
        ({ case: 'Path', value, type: 'PatternToken' }),
    Part: value =>
        ({ case: 'Part', value, type: 'PatternToken' }),
    Variadic: value =>
        ({ case: 'Variadic', value, type: 'PatternToken' }),

    fold: ({
        Path,
        Part,
        Variadic
    }) => o => ({
        Path,
        Part,
        Variadic
    })[o.case](o.value),

    infer: segment =>
        segment.startsWith(':')
            ? PatternToken.Part(segment.slice(1))
        : segment.startsWith('...')
            ? PatternToken.Variadic(segment.split('...')[1])
        : PatternToken.Path(segment),

        
    validations: {
        variadicPosition: tokens => {
            const index =
                tokens.findIndex(PatternToken.isVariadic)

            if (index > -1 && index != tokens.length - 1) {
                return Valid.N(
                    PatternToken.Error.VariadicPosition({ 
                        tokens, index 
                    })
                )
            } else {
                return Valid.Y(tokens)
            }
        },

        variadicCount: tokens => {
            const variadics =
                tokens.filter(PatternToken.isVariadic)

            if (variadics.length > 1) {
                return Valid.N(
                    PatternToken.Error.VariadicCount({
                        variadics, tokens
                    })
                )
            } else {
                return Valid.Y(tokens)
            }
        }
    },

    Error: {
        name: 'PatternToken.Error',
        VariadicPosition({ tokens, index }){
            return {
                type: 'PatternToken.Error',
                case: 'VariadicPosition',
                value: new TypeError(
                    'Variadic ' + JSON.stringify(
                        PatternToken.toString(tokens[index])
                    )
                    + ' found at position ' + index + ' of ' + tokens.length 
                    + ' of pattern ' + JSON.stringify(
                        PatternToken.toPattern(tokens)
                    ) + '.  ' 
                    + 'Variadics can only be in the final position.'
                )
            }
        },

        VariadicCount({ variadics, tokens }){
            return {
                type: 'PatternToken.Error',
                case: 'VariadicCount',
                value: new TypeError(
                    'Found ' + variadics.length + ' variadics in pattern '
                    + PatternToken.toPattern(tokens) + '.  '
                    + 'A maxiumum of 1 variadic is allowed.'
                )
            }
        }
        
    },

    isVariadic: o => o.case === 'Variadic',

    validate(tokens){
        const out =
            Object.values(PatternToken.validations).map(
                f => f(tokens)
            )

        const invalids = out.filter( x => x.case === 'N')
            .map( x => x.value )

        return invalids.length > 0
            ? Valid.N(invalids)
            : Valid.Y(tokens)
    },

    toString: x => ({
        Path: x => x
        ,Part: x => ':'+x
        ,Variadic: x => '...'+x
    })[x.case](x.value),

    toPattern: xs => xs.map( PatternToken.toString ).join('/')
}

const URLToken = {
    Path: value =>
        ({ case: 'Path', value, type: 'URLToken' }),
    Part: ({ key, value }) =>
        ({ case: 'Part', value: { key, value, type: 'URLToken' } }),
    Variadic: ({ key, value }) =>
        ({ case: 'Variadic', value: { key, value, type: 'URLToken' } }),
    Unmatched: ({expected, actual}) =>
        ({ case: 'Unmatched', value: { expected, actual }, type: 'URLToken' }),
    ExcessSegment: segment =>
        ({ case: 'ExcessSegment', value: segment, type: 'URLToken' }),

    fold: ({
        Path,Part,Variadic,Unmatched,ExcessSegment 
    }) => x => ({
        Path,Part,Variadic,Unmatched,ExcessSegment
    })[x.case](x.value),

    toString: x => URLToken.fold({
        Path: x => x
        ,Part: ({ value: x }) => x
        ,Variadic: ({ value: x }) => x
        ,Unmatched: ({ actual: x }) => x
        ,ExcessSegment: x => x
    }) (x),

    toURL: xs => xs.map( URLToken.toString ).join('/'),

    fromPattern: o => segment => PatternToken.fold({
        Path: expected =>
            segment === expected 
                ? URLToken.Path(segment)
                : URLToken.Unmatched({ expected, actual: segment }),
        Part: key =>
            URLToken.Part({ key, value: segment }),
        Variadic: key =>
            URLToken.Variadic({ key, value: segment })
    }) (o),

    isVariadic: o => o.case === 'Variadic',

    validations: {
        
        excessPatterns: patternTokens => urlTokens => {

            const numSegments = 
                urlTokens.length

            const numPatterns =
                patternTokens.length
                
            const excessPatterns = 
                numPatterns > numSegments
                ? patternTokens.slice(numSegments)
                : []

            if( excessPatterns.length ){
                return Valid.N(
                    URLToken.Error.ExcessPattern({
                        urlTokens, patternTokens,
                        excessPatterns
                    })
                )
            } else {
                return Valid.Y(urlTokens)
            }
        },

        excessSegments: patternTokens => urlTokens => {
            const extraSegments = 
                urlTokens.filter( x => x.case === 'ExcessSegment' )
                
            if ( extraSegments.length 
                && patternTokens.slice(-1)[0].case !== 'Variadic' 
            ){
                return Valid.N(
                    URLToken.Error.ExcessSegment({
                        patternTokens, extraSegments
                    })
                )
            } else {
                return Valid.Y(urlTokens)
            }
        },

        unmatchedPaths: patternTokens => urlTokens => {
            const unmatched =
                urlTokens.filter( x => x.case === 'Unmatched' )

            if( unmatched.length ){
                return Valid.N(
                    URLToken.Error.UnmatchedPaths({ patternTokens, urlTokens })
                )
            } else {
                return Valid.Y(urlTokens)
            }
        }
        
    },

    Error: {
        UnmatchedPaths({ patternTokens, urlTokens }){
            return {
                type: 'URLToken.Error',
                case: 'UnmatchedPaths',
                value:
                    new TypeError(
                        "Pattern "+PatternToken.toPattern(patternTokens)
                            + " could not match URL "
                            + URLToken.toURL(urlTokens)
                            + " due to unmatched path segments: "
                            + urlTokens.map(
                
                                x => x.case === 'Unmatched'
                                    ? URLToken.toString(x)
                                    : '...'
                            )
                            .join('/')
                    )
            }
        },

        ExcessSegment({ patternTokens, extraSegments }){
            return {
                type: 'URLToken.Error',
                case: 'ExcessSegment',
                value: new TypeError(
                    'Excess tokens ('
                        + JSON.stringify(
                            '/'+extraSegments.map( x => x.value).join('/')
                        )
                        + ')'
                    + ' were found and the URLPattern:'
                        + JSON.stringify(
                            PatternToken.toPattern(patternTokens)
                        )
                          
                    + ' did not contain a variadic for the additional'
                    + ' values.'
                )
            }
        },

        ExcessPattern({ urlTokens, excessPatterns, patternTokens }){
            return {
                type: 'URLToken.Error',
                case: 'ExcessPattern',
                value: new TypeError(
                    'The URL '+ URLToken.toURL(urlTokens) 
                    +' had excess patterns ('
                        + PatternToken.toPattern(excessPatterns)
                    + ')'
                    + 'when parsed as part of pattern:'
                        + ' ' +PatternToken.toPattern(patternTokens)
                )
            }
        }
    },

    transforms: {
        collectVariadics: url => patternTokens => urlTokens => {

            const extraSegments = 
                urlTokens.length > patternTokens.length 
                    ? patternTokens.slice( urlTokens.length )
                    : []

            if ( extraSegments ){
                
                const index =
                    urlTokens.findIndex(URLToken.isVariadic)

                if (index == -1) {
                    return urlTokens
                } else {
                    const { key, value } = urlTokens[index].value
                    
                    return urlTokens.slice(0, patternTokens.length-1).concat(
                        URLToken.Variadic(
                            {
                                key
                                , value: value
                                    + '/'
                                    + url.split('/')
                                        .slice(patternTokens.length)
                                        .join('/')
                            }
                        )
                    )
                }
            } else {
                return urlTokens
            }
        }
    },

    transform: (url, urlTokens, patternTokens) => {
        
        return Object.values(URLToken.transforms).reduce(
            (p, f) => f (url) (patternTokens) (p),
            urlTokens
        )
    },

    validate(patternTokens, urlTokens){
        const out =
            Object.values(URLToken.validations).map(
                f => f(patternTokens) (urlTokens)
            )

        const invalids = out.filter( x => x.case === 'N')
            .map( x => x.value )

        return invalids.length > 0
            ? Valid.N(invalids)
            : Valid.Y(urlTokens)
    }
}

function tokenizePattern(pattern) {

    const patternTokens =
        pattern.split('/').map(PatternToken.infer)

    return [patternTokens]
            .map(PatternToken.validate)
            .shift()
}

function tokenizeURL(patternTokens, url){
    const urlTokens =
        url.split('/').slice(0, patternTokens.length).map(
            (segment, i) => 
                URLToken.fromPattern (patternTokens[i]) (segment)
        )

    const segments =
        url.split('/')
    
    const numSegments = 
        segments.length

    const numPatterns =
        patternTokens.length
        
    const excessSegments = 
        numSegments > numPatterns
        ? segments.slice(numPatterns).map(
            URLToken.ExcessSegment
        )
        : []
     
    const completeTokens =
        urlTokens
        .concat(excessSegments)

    
    return [URLToken.validate(patternTokens, completeTokens)]
        .map(
            Valid.map(
                () => URLToken.transform(url, completeTokens, patternTokens)
            )
        )
        .shift()
}

function type(typeName, cases){
    const tokenized = 
        Object.entries(cases).map(
            ([caseName, pattern]) => {
                return { [caseName]: tokenizePattern(pattern) }
            }
        )
        .reduce( (p,n) => Object.assign(p, n), {} )

    const invalids =
        Object.entries(tokenized).filter(
            ([, tokens]) => tokens.case === 'N'
        )
        .map( ([key, x]) => [key, x.value] )

    if( invalids.length ){
        throw invalids[0].value
    } else {
        
        const RouteSafe =
            Object.entries(tokenized).map(
                ([caseName, tokens]) => {
                    const keys = 
                        tokens.value.reduce(
                            (p, n) => 
                                PatternToken.fold({
                                    Path: () => p,
                                    Part: key => p.concat(key),
                                    Variadic: key => p.concat(key)
                                }) (n),
                            []
                        )
                        .sort()

                    function of(o) {

                        const foundKeys = Object.keys(o || {}).sort()
                        
                        if( foundKeys.join('|') !== keys.join('|') ){
                            return Valid.N( 
                                new TypeError(
                                    "Property mismatch for "
                                        +typeName+'.'+caseName
                                        + ".  Expected: {"+keys.join(',')+"}"
                                        + " but found: {"+foundKeys.join()+"}"
                                )
                            )
                        } else {
                            return Valid.Y(
                                {
                                    type: typeName,
                                    case: caseName,
                                    value: o
                                }
                            )
                        }
                    }

                    return { [caseName]: of }
                }
            )
            .reduce( (p,n) => Object.assign(p,n), { })
    
        const Route = 
            Object.entries(RouteSafe).map(
                ([key, of]) => ({ 
                    [key]: o => Valid.fold({
                        Y: x => x,
                        N(err){
                            throw err
                        }
                    }) ( of(o) )
                    
                })
            )
            .reduce( (p,n) => Object.assign(p,n), {})

        Route.safe = RouteSafe

        Route.fold = cases => o => cases[o.case](o.value)

        Route.matchesOr = function matchesOr(otherwise, url){

            const pairs = 
                Object.entries(tokenized).map(
                    ([key, patternTokens]) => 
                        [key, tokenizeURL(patternTokens.value, url)]
                )

            const invalid = 
                pairs
                .filter( ([,valid]) => valid.case === 'N' )
                .map(
                    ([key, { value }]) => ({ [key]: value})
                )
                .reduce( (p,n) => Object.assign(p,n), {})

            const valid = 
                pairs
                .filter( ([,valid]) => valid.case === 'Y' )
                .sort(
                    ([,{ value: a}], [,{ value: b}]) => b.length - a.length
                )
                .map(
                    ([caseName, { value }]) => Route[caseName](
                        value.reduce(
                            (p,n) => URLToken.fold({
                                ExcessSegment: () => p,
                                Part: ({ key, value }) => Object.assign(p, { [key]: value }),
                                Path: () => p,
                                Unmatched: () => p,
                                Variadic: ({ key, value }) => Object.assign(p, { [key]: value })
                            }) (n),
                            {}
                        )
                    )
                )

            if( valid.length ) {
                return valid
            } else if( Object.keys(invalid).length) {
                return otherwise(invalid) 
            } else {
                return otherwise({})
            }

        }
        
        return Route
    }
}

module.exports = {
    tokenizePattern
    , tokenizeURL
    , PatternToken
    , URLToken
    , type
}