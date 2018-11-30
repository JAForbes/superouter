const Valid = {
    name: 'Valid'
    ,Y: value => ({ case: 'Y', type: 'Valid', value})
    ,N: value => ({ case: 'N', type: 'Valid', value})
    ,bifold: (N,Y) => o => ({
        Y
        ,N
    })[o.case](o.value)
    ,fold: ({ Y,N }) => o => ({ Y,N })[o.case](o.value)
    ,map: f => o => ({
        Y: x => Valid.Y(f(x))
        ,N: () => o
    })[o.case](o.value)
}

const PatternToken = {
    name: 'PatternToken'
    ,Path: value =>
        ({ case: 'Path', value, type: 'PatternToken' })
    ,Part: value =>
        ({ case: 'Part', value, type: 'PatternToken' })
    ,Variadic: value =>
        ({ case: 'Variadic', value, type: 'PatternToken' })

    ,specificity: token => PatternToken.fold({
        Path: () => 0x100
        ,Part: () => 0x010
        ,Variadic: () => 0x001
    }) (token)

    ,groupSpecificity: tokens => 
        tokens.map(PatternToken.specificity)
            .reduce( (p,n) => p+n, 0)

    ,fold: ({
        Path,
        Part,
        Variadic
    }) => o => ({
        Path
        ,Part
        ,Variadic
    })[o.case](o.value)

    ,infer: segment =>
        segment.startsWith(':')
            ? PatternToken.Part(segment.slice(1))
        : segment.startsWith('...')
            ? PatternToken.Variadic(segment.split('...')[1])
        : PatternToken.Path(segment)

    ,groupValidations: {
        duplicateDef: allTokensPairs => {

            // Pair (CaseName, PatternStr)
            const patterns = 
                allTokensPairs.map(
                    ([k,v]) => [k, PatternToken.toPattern(v)]
                )
            
            // StrMap (PatternStr, CaseName[])
            const patternStrDupeSearch =
                patterns.reduce(
                    (p,[caseName,pattern]) => {
                        p[pattern] = p[pattern] || []
                        p[pattern].push(caseName)
    
                        return p
                    }
                    , {}
                )
    
            // StrMap (CaseName, DupeMetaData)
            // where 
            // DupeMetaData = 
            //  { caseNames::CaseName[], patternStr::PatternStr }
            const caseDupes = 
                Object.entries(patternStrDupeSearch)
                    .reduce(
                        (p, [patternStr, caseNames]) => {

                            if( caseNames.length > 1 ){
                                caseNames.forEach(
                                    (caseName) => {
                                        p[caseName] = {
                                            caseNames, patternStr
                                        }
                                    }
                                )
                            }
                            return p
                        }
                        ,{}
                    )
    
            if ( Object.keys(caseDupes).length ){
                return Valid.N(
                    // StrMap (CaseName, PatternToken.Error )
                    Object.entries(caseDupes)
                        .map(
                            ([caseName, { caseNames, patternStr }]) => 
                                [ caseName
                                , PatternToken.Error.DuplicateDef({
                                    caseNames, patternStr
                                })
                                ]
                        )
                )
            } else {
                return Valid.Y(
                    allTokensPairs
                )
            }
        }
    }

    ,singleValidations: {
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
        }

        ,variadicCount: tokens => {
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

        ,duplicatePart: tokens => {
            
            const dupeParts =
                [
                    tokens.flatMap(
                        PatternToken.fold({
                            Path: () => []
                            ,Part: x => [x] 
                            ,Variadic: x => [x]
                        })
                    )
                    .reduce(
                        (p,n) => {
                            p[n] = p[n] || 0
                            p[n] = p[n] + 1
                            return p
                        }
                        ,{}
                    )
                ]
                .flatMap( 
                    o => Object.entries(o)
                        .flatMap( ([k,v]) => v > 1 ? [k] : [])
                )

            if (dupeParts.length) {
                return Valid.N(
                    PatternToken.Error.DuplicatePart({
                        dupeParts
                    })
                )
            } else {
                return Valid.Y(tokens)
            }
        }
    }

    ,Error: {
        name: 'PatternToken.Error'
        ,VariadicPosition({ tokens, index }){
            return {
                type: 'PatternToken.Error'
                ,case: 'VariadicPosition'
                ,value: new TypeError(
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
        }

        ,VariadicCount({ variadics, tokens }){
            return {
                type: 'PatternToken.Error'
                ,case: 'VariadicCount'
                ,value: new TypeError(
                    'Found ' + variadics.length + ' variadics in pattern '
                    + PatternToken.toPattern(tokens) + '.  '
                    + 'A maxiumum of 1 variadic is allowed.'
                )
            }
        }

        ,DuplicateDef({ caseNames, patternStr }){
            return {
                type: 'PatternToken.Error'
                ,case: 'DuplicateDef'
                ,value: new TypeError(
                    'Found duplicate pattern defintions for '
                    + 'routes: '+caseNames.join(', ')+'.  '
                    + 'They all have equivalent pattern strings: '
                    + patternStr + '.  '
                    + 'Duplicated patterns lead to ambiguous matches.'
                )
            }
        }

        ,DuplicatePart({ dupeParts }){
            return {
                type: 'PatternToken.Error'
                ,case: 'DuplicatePart'
                ,value: new TypeError(
                    'Found duplicate variable bindings: '
                    + dupeParts.join(', ')
                    + '.  Duplicated names lead to ambiguous bindings.'
                )
            }
        }
        
    }

    ,isVariadic: o => o.case === 'Variadic'

    ,validate(tokens){
        const out =
            Object.values(PatternToken.singleValidations).map(
                f => f(tokens)
            )

        const invalids = out.filter( x => x.case === 'N')
            .map( x => x.value )

        return invalids.length > 0
            ? Valid.N(invalids)
            : Valid.Y(tokens)
    }

    ,validateGroup(allTokensGroup){

        const validTokensGroup = 
            allTokensGroup.filter( ([,v]) => v.case === 'Y' )
            
        const out =
            Object.values(PatternToken.groupValidations)
            .map(
                f => f( validTokensGroup.map( ([k,v]) => [k, v.value] ) )
            )

        const invalids = out.filter( x => x.case === 'N')
            .map( x => x.value )

        return invalids.length > 0
            ? Valid.N(invalids)
            : Valid.Y(allTokensGroup)
    }


    ,toString: x => ({
        Path: x => x
        ,Part: x => ':'+x
        ,Variadic: x => '...'+x
    })[x.case](x.value)

    ,toPattern: xs => xs.map( PatternToken.toString ).join('/')
}

const URLToken = {
    Path: value =>
        ({ case: 'Path', value, type: 'URLToken' })
    ,Part: ({ key, value }) =>
        ({ case: 'Part', value: { key, value, type: 'URLToken' } })
    ,Variadic: ({ key, value }) =>
        ({ case: 'Variadic', value: { key, value, type: 'URLToken' } })
    ,Unmatched: ({expected, actual}) =>
        ({ case: 'Unmatched', value: { expected, actual }, type: 'URLToken' })
    ,ExcessSegment: segment =>
        ({ case: 'ExcessSegment', value: segment, type: 'URLToken' })

    ,fold: ({
        Path,Part,Variadic,Unmatched,ExcessSegment 
    }) => x => ({
        Path,Part,Variadic,Unmatched,ExcessSegment
    })[x.case](x.value)

    ,toString: x => URLToken.fold({
        Path: x => x
        ,Part: ({ value: x }) => x
        ,Variadic: ({ value: x }) => x
        ,Unmatched: ({ actual: x }) => x
        ,ExcessSegment: x => x
    }) (x)

    ,toURL: xs => xs.map( URLToken.toString ).join('/')

    ,toArgs: xs => xs.reduce(
        (p,n) => URLToken.fold({
            ExcessSegment: () => p
            ,Part: ({ key, value }) => 
                Object.assign(p, { [key]: value })
            ,Path: () => p
            ,Unmatched: () => p
            ,Variadic: ({ key, value }) => 
                Object.assign(p, { [key]: value })
        }) (n),
        {}
    )

    ,fromPattern: o => segment => PatternToken.fold({
        Path: expected =>
            segment === expected 
                ? URLToken.Path(segment)
                : URLToken.Unmatched({ expected, actual: segment })
        ,Part: key =>
            URLToken.Part({ key, value: segment })
        ,Variadic: key =>
            URLToken.Variadic({ key, value: segment })
    }) (o)

    ,isVariadic: o => o.case === 'Variadic'

    ,validations: {
        
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
                        urlTokens, patternTokens
                        ,excessPatterns
                    })
                )
            } else {
                return Valid.Y(urlTokens)
            }
        }

        ,excessSegments: patternTokens => urlTokens => {
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
        }

        ,unmatchedPaths: patternTokens => urlTokens => {
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
        
    }

    ,Error: {
        UnmatchedPaths({ patternTokens, urlTokens }){
            return {
                type: 'URLToken.Error'
                ,case: 'UnmatchedPaths'
                ,value:
                    new TypeError(
                        'Pattern '+PatternToken.toPattern(patternTokens)
                            + ' could not match URL '
                            + URLToken.toURL(urlTokens)
                            + ' due to unmatched path segments: '
                            + urlTokens.map(
                
                                x => x.case === 'Unmatched'
                                    ? URLToken.toString(x)
                                    : '...'
                            )
                            .join('/')
                    )
            }
        }

        ,ExcessSegment({ patternTokens, extraSegments }){
            return {
                type: 'URLToken.Error'
                ,case: 'ExcessSegment'
                ,value: new TypeError(
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
        }

        ,ExcessPattern({ urlTokens, excessPatterns, patternTokens }){
            return {
                type: 'URLToken.Error'
                ,case: 'ExcessPattern'
                ,value: new TypeError(
                    'The URL '+ URLToken.toURL(urlTokens) 
                    +' had excess patterns ('
                        + PatternToken.toPattern(excessPatterns)
                    + ')'
                    + 'when parsed as part of pattern:'
                        + ' ' +PatternToken.toPattern(patternTokens)
                )
            }
        }
    }

    ,transforms: {
        collectVariadics: url => patternTokens => urlTokens => {

            const extraSegments = 
                urlTokens.length > patternTokens.length 
                    ? urlTokens.slice( patternTokens.length )
                    : []

            if ( extraSegments.length ){
                
                const index =
                    urlTokens.findIndex(URLToken.isVariadic)

                // Technically not possible because excess segments
                // without variadics isn't valid and would be caught
                // earlier.  But typesafety 😐
                /* istanbul ignore next */
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
    }

    ,transform: (url, urlTokens, patternTokens) => {
        return Object.values(URLToken.transforms).reduce(
            (p, f) => f (url) (patternTokens) (p),
            urlTokens
        )
    }

    ,validate(patternTokens, urlTokens){
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

function routeValidator({ tokenized }){
    
    const groupInvalids = 
        [
            PatternToken.validateGroup(
                Object.entries(tokenized)
            )
        ]
        .flatMap(
            Valid.bifold(
                x => x, () => []
            )
        )
        .shift()

    // Pair (CaseName, PatternToken.Error[])
    const invalids =
        Object.entries(tokenized).filter(
            ([, tokens]) => tokens.case === 'N'
        )
        .map( ([key, x]) => [key, x.value] )

    if( invalids.length ){
        return Valid.N(
            invalids
                .concat(groupInvalids)
                .concat(
                    Object.entries(tokenized)
                    .filter( ([,tokens]) => tokens.case === 'Y' )
                    .map(([k]) => [k, []])
                )
                .reduce( (p,[k,v]) => {
                    p[k] = p[k] || []
                    p[k] = p[k].concat(v) 
                    return p
                }, {})
                
        )
    } else {
        return Valid.Y(tokenized)
    }
}

function SafeRouteType({ typeName, tokenized }){
    
    return Object.entries(tokenized).map(
        ([caseName, tokens]) => {
            const keys = 
                tokens.value.reduce(
                    (p, n) => 
                        PatternToken.fold({
                            Path: () => p
                            ,Part: key => p.concat(key)
                            ,Variadic: key => p.concat(key)
                        }) (n),
                    []
                )
                .sort()

            function of(o) {

                const foundKeys = Object.keys(o || {}).sort()
                
                if( foundKeys.join('|') !== keys.join('|') ){
                    return Valid.N( 
                        new TypeError(
                            'Property mismatch for '
                                +typeName+'.'+caseName
                                + '.  Expected: {'+keys.join(',')+'}'
                                + ' but found: {'+foundKeys.join()+'}'
                        )
                    )
                } else {
                    return Valid.Y(
                        {
                            type: typeName
                            ,case: caseName
                            ,value: o
                        }
                    )
                }
            }

            return { [caseName]: of }
        }
    )
    .reduce( (p,n) => Object.assign(p,n))
}

function RouteType({ typeName, safeRouteType }){

    const Route =
        Object.entries(safeRouteType).map(
            ([key, of]) => ({ 
                [key]: o => Valid.fold({
                    Y: x => x
                    ,N(err){
                        throw err
                    }
                }) ( of(o) )
                
            })
        )
        .reduce( (p,n) => Object.assign(p,n), { name: typeName })

    return Route
}

const PatternMatches = 
    ({ tokenized, url }) => {

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
                ([,{ value: a}], [,{ value: b}]) => 
                    PatternToken.groupSpecificity(b) 
                    - PatternToken.groupSpecificity(a)
            )
            
        if( valid.length ) {
            return Valid.Y(valid)
        } else {
            return Valid.N(invalid)
        }
    }

const Matches = 
    ({ routeType }) => patternMatches => {

        return Valid.bifold(
            Valid.N,
            xs => 
                // xs being non empty is technically a precondition
                // to being marked as valid
                // but we check it in any case as the types make it possible
                xs.length == 0
                /* istanbul ignore next */
                ? Valid.N({})
                : Valid.Y(
                    xs.map(
                        ([caseName, { value }]) => 
                            routeType[caseName](
                                URLToken.toArgs(value)
                            )
                    )
                )
        ) (patternMatches)
    }

function type$safe(typeName, cases){
    // StrMap (CaseName, Valid( N::PatternToken.Error[] | Y::PatternToken[] ) )
    const tokenized = 
        Object.entries(cases).map(
            ([caseName, pattern]) => {
                return { [caseName]: tokenizePattern(pattern) }
            }
        )
        .reduce( (p,n) => Object.assign(p, n), {} )

    const validated = routeValidator({ tokenized })

    if( validated.case === 'N' ){
        return validated
    } else {

        const safeRouteType =
            SafeRouteType({ typeName, tokenized })
        
        const routeType = 
            RouteType({ typeName, safeRouteType })

        const fold = cases => o => cases[o.case](o.value)

        const matches = url => {
            const patternMatches = PatternMatches({tokenized, url})    
            return Matches({ routeType }) (patternMatches)
        }

        const matchOr = (otherwise, url) => 
            [url]
            .map(matches)
            .flatMap(
                Valid.bifold(
                    otherwise,
                    x => x
                )
            )
            .slice(0,1)
            .concat( otherwise({}) )
            .shift()

        const toURL = routeCase => {
            return tokenized[routeCase.case].value.map(
                PatternToken.fold({
                    Part: key => routeCase.value[key]
                    ,Path: key => key
                    ,Variadic: key => routeCase.value[key]
                })
            )
            .join('/')
        }

        return Valid.Y(
            { safe: safeRouteType
            , of: routeType
            , fold
            , matches
            , matchOr
            , toURL
            }
        )
    }
}

const type = 
    (typename, cases) => 
        Valid.bifold(
            (errs) => {
                throw Object.values(errs)
                    .flatMap( xs =>  xs )
                    .map( x => x.value)
                    .shift()
            },
            x => x
        ) (type$safe(typename, cases))


module.exports = 
    { tokenizePattern
    , tokenizeURL
    , PatternToken
    , URLToken
    , Valid
    , type$safe
    , type
    }