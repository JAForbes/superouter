const { tokenize } = require('.')

const routes = {
    '/': () => 'home',
    '/posts/:post': ({ post }) => ({ post }),
    '/about': () => 'about',
    '/a/:b/c/:d': () => 'yes'
}


const urls = [
    '/', '/posts/hi-there', '/nomatch/.exe', '/about', '/a/1/c/2'
]

tokenize('posts/:post/...rest', 'posts/hi-there/2/3')
