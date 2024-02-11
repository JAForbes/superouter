
export function normalizePathSegment(s: string): string{
  if( s == '' || s == '/' ) {
    return '/'
  } else if ( s.startsWith('/') && s.endsWith('/') ) {
    return s.slice(0, -1)
  } else if ( !s.startsWith('/') && s.endsWith('/') ) {
    return '/' + s.slice(0, -1)
  } else {
    return s
  }
}

export function normalizeRest(s:string): string {
  if ( !s ) {
    s = ''
  }
  if (s.at(0) == '/') {
    s = s.slice(1)
  }
  if (s.at(-1) == '/') {
    s = s.slice(0,-1)
  }
  return s
}