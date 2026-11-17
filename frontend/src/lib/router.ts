import { useEffect, useState } from 'react'

// Tiny hash router: #/plan/abc → { name: 'plan', param: 'abc' }. No dependency needed.
export interface Route {
  name: string
  param: string | null
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [name, param] = clean.split('/')
  return { name: name || '', param: param ? decodeURIComponent(param) : null }
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
