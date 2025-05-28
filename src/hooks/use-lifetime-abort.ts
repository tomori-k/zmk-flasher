import { useRef, useEffect } from 'react'

export function useLifetimeAbort(): React.RefObject<AbortController | null> {
  const refAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    refAbort.current = new AbortController()
    return () => {
      refAbort.current!.abort()
    }
  }, [])

  return refAbort
}
