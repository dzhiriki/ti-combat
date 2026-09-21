import { useEffect, useRef, useState } from 'react'

import type { CombatOutcome } from '@/combat'
import type { SimulationInput } from '@/hooks/combat-setup'

const DEBOUNCE_MS = 0

export function useSimulation(input: SimulationInput | null): {
  outcomes: CombatOutcome[] | null
  isComputing: boolean
} {
  const [state, setState] = useState<{
    outcomes: CombatOutcome[] | null
    forInput: SimulationInput | null
  }>({ outcomes: null, forInput: null })
  const workerRef = useRef<Worker | null>(null)
  const busyRef = useRef(false)
  const pendingInputRef = useRef<SimulationInput | null>(null)

  useEffect(() => {
    if (input === null) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      busyRef.current = false
      pendingInputRef.current = null
      return
    }

    const timer = setTimeout(() => {
      // Busy: kill the in-flight worker — sync simulate() can't be interrupted
      // any other way. Idle: reuse the existing worker and skip cold-start.
      if (busyRef.current && workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
        busyRef.current = false
      }

      let worker = workerRef.current
      if (!worker) {
        worker = new Worker(
          new URL('../combat/combat.worker.ts', import.meta.url),
          { type: 'module' },
        )
        worker.onmessage = (e: MessageEvent<CombatOutcome[]>) => {
          console.timeEnd('useSimulation')
          const forInput = pendingInputRef.current
          busyRef.current = false
          pendingInputRef.current = null
          setState({ outcomes: e.data, forInput })
        }
        workerRef.current = worker
      }

      console.time('useSimulation')
      busyRef.current = true
      pendingInputRef.current = input
      worker.postMessage(input)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [input])

  useEffect(
    () => () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    },
    [],
  )

  if (input === null) {
    return { outcomes: null, isComputing: false }
  }

  return {
    outcomes: state.outcomes,
    isComputing: state.forInput !== input,
  }
}
