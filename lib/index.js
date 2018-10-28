const Valid = {
    name: 'Valid',
    Y: value => ({ case: 'Y', type: 'Valid', value}),
    N: value => ({ case: 'N', type: 'Valid', value}),
    bifold: (N,Y) => o => ({
        Y,
        N
    })[o.case](o.value),
    
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

    toString: x => ({
        Path: x => x
        ,Part: x => ':'+x
        ,Variadic: x => '...'+x
        ,Unmatched: x => x
        ,ExcessSegment: x => x
    })[x.case](x.value),

    toURL: xs => xs.map( URLToken.toString ).join('/'),

    fromPattern: o => segment => ({
        Path: expected =>
            segment === expected 
                ? URLToken.Path(segment)
                : URLToken.Unmatched({ expected, actual: segment }),
        Part: key =>
            URLToken.Part({ key, value: segment }),
        Variadic: key =>
            URLToken.Variadic({ key, value: segment })
    })[o.case](o.value),

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
                    new Error(
                        'The URL '+ URLToken.toURL(urlTokens) 
                        +' had excess patterns ('
                            + PatternToken.toPattern(excessPatterns)
                        + ')'
                        + 'when parsed as part of pattern:'
                            + ' ' +PatternToken.toPattern(patternTokens)
                    )
                )
            } else {
                return Valid.Y(urlTokens)
            }
        },

        excessSegments: patternTokens => urlTokens => {
            const extraSegments = 
                urlTokens.filter( x => x.case === 'ExcessSegment' )
                
            if ( extraSegments.length 
                && urlTokens.slice(-1)[0].case !== 'Variadic' 
            ){
                return Valid.N(
                    new Error(
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
                )
            } else {
                return Valid.Y(urlTokens)
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
                    
                    return urlTokens.slice(0, -1).concat(
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


module.exports = {
    tokenizePattern
    , tokenizeURL
    , PatternToken
}