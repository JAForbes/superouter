const Pattern = {
    Path: value =>
        ({ case: 'Path', value, type: 'Pattern' }),
    Part: ({ key, value }) =>
        ({ case: 'Part', value: { key, value, type: 'Pattern' } }),
    Variadic: ({ key, value }) =>
        ({ case: 'Variadic', value: { key, value, type: 'Pattern' } }),
    Unmatched: value =>
        ({ case: 'Unmatched', value, type: 'Pattern' }),

    fold: ({
        Path,
        Part,
        Variadic,
        Unmatched
    }) => o => ({
        Path,
        Part,
        Variadic,
        Unmatched
    })[o.case](o.value),

    infer: segment =>
        segment.startsWith(':')
            ? value =>
                Pattern.Part({
                    key: segment.slice(1), value
                })
            : segment.startsWith('...')
                ? value => Pattern.Variadic({
                    key: segment.split('...')[1], value
                })
            : path => path === segment
                ? Pattern.Path(segment)
                : Pattern.Unmatched(),

    isVariadic: x => x.case === 'Variadic',
}

const Token = {
    Path: value =>
        ({ case: 'Path', value, type: 'Token' }),
    Part: ({ key, value }) =>
        ({ case: 'Part', value: { key, value, type: 'Token' } }),
    Variadic: ({ key, value }) =>
        ({ case: 'Variadic', value: { key, value, type: 'Token' } }),
    Unmatched: value =>
        ({ case: 'Unmatched', value, type: 'Token' }),

    fromPattern: o => ({
        Path: value =>
            ({ case: 'Path', value, type }),
        Part: ({ key, value }) =>
            ({ case: 'Part', value: { key, value, type } }),
        Variadic: ({ key, value }) =>
            ({ case: 'Variadic', value: { key, value, type } }),
        Unmatched: value =>
            ({ case: 'Unmatched', value, type }),
    })[o.case](o.vallue)
}

const transforms = {
    collectVariadics: (tokens, types) => {

        const index =
            tokens.findIndex(Pattern.isVariadic)

        if (index == -1) {
            return tokens
        }

        const { key, value } = tokens[index].value
        return tokens.slice(0, -1).concat(
            Pattern.Variadic(
                {
                    key
                    , value: value
                        + '/'
                        + url.split('/').slice(types.length).join('/')
                }
            )
        )
    }
}

const validations = {
    variadicPosition: tokens => {
        const index =
            tokens.findIndex(Pattern.isVariadic)

        if (index > -1 && index != tokens.length - 1) {
            throw new Error(
                'Variadic ...' + tokens[index].value.key
                + ' found at position ' + index + ' of ' + tokens.length + '.  '
                + 'Variadic can only be in the final position.'
            )
        }
    },

    variadicCount: tokens => {
        const variadics =
            tokens.filter(Pattern.isVariadic)

        if (variadics.length > 1) {
            throw new Error(
                'Found ' + variadics.length + ' variadics in pattern '
                + pattern + '.  '
                + 'A maxiumum of 1 variadic is allowed.'
            )
        }
    }
}

function tokenize(pattern, url) {

    const types =
        pattern.split('/').map(Pattern.infer)

    const tokens =
        url.split('/').flatMap(
            (segment, i) =>
                [types[i]]
                    .filter(Boolean)
                    .map(f => f(segment))
        )

    validations.variadicCount(tokens)
    validations.variadicPosition(tokens)

    return transforms.collectVariadics(
        tokens, types
    )
}


module.exports = {
    tokenize, Pattern
}