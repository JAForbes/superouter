console.log('---')

const { tokenizePattern, tokenizeURL, URLToken, PatternToken } = require('.')


const routes = {
    '/': () => 'home',
    '/posts/:post': ({ post }) => ({ post }),
    '/about': () => 'about',
    '/a/:b/c/:d': () => 'yes'
}


const urls = [
    '/', '/posts/hi-there', '/nomatch/.exe', '/about', '/a/1/c/2'
]

{
    const pattern = 'posts/:post/...rest'
    const url = 'posts/hi-there/2/3'
    const patternTokens = 
        tokenizePattern(pattern)

    const urlTokens =
        patternTokens.case === 'Y'
        ? tokenizeURL(patternTokens.value, url)
        : []

    console.log({
        patternTokens, urlTokens
    })


}



