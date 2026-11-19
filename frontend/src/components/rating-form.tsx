import type { RatingInput } from '@exitslide/contracts'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState, type FormEvent } from 'react'
import { submitRating } from '../server/public-sessions'
import { Button } from './ui/button'

type RatingState =
  | { kind: 'ready' }
  | { kind: 'sending' }
  | { kind: 'saved' }
  | { kind: 'retry' | 'unavailable'; message: string }

export function RatingForm({ sessionId }: { sessionId: string }) {
  const send = useServerFn(submitRating)
  const [selected, setSelected] = useState<number>()
  const [state, setState] = useState<RatingState>({ kind: 'ready' })
  const attempt = useRef<RatingInput | undefined>(undefined)
  const busy = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || busy.current || state.kind === 'saved' || state.kind === 'unavailable') return
    attempt.current ??= { score: selected, submissionId: crypto.randomUUID() }
    busy.current = true
    setState({ kind: 'sending' })

    try {
      const result = await send({ data: { id: sessionId, rating: attempt.current } })
      if (result.ok) setState({ kind: 'saved' })
      else if (result.status === 404 || result.status === 409) {
        setState({ kind: 'unavailable', message: result.message })
      } else setState({ kind: 'retry', message: result.message })
    } catch {
      setState({ kind: 'retry', message: 'Couldn’t confirm your rating. Try again.' })
    } finally {
      busy.current = false
    }
  }

  const finished = state.kind === 'saved' || state.kind === 'unavailable'
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
      <fieldset disabled={state.kind !== 'ready'}>
        <legend className="mb-3 text-xl font-semibold">Rate this Session <span className="text-sm font-normal text-slate-600">(optional)</span></legend>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5].map(score => (
            <label key={score} className="cursor-pointer">
              <input type="radio" name="rating" value={score} checked={selected === score}
                onChange={() => setSelected(score)} className="peer sr-only"
                aria-label={score === 1 ? '1 star' : score + ' stars'} />
              <span aria-hidden="true" className={
                'grid size-10 place-items-center rounded-md border border-slate-200 text-2xl peer-focus-visible:outline-2 peer-focus-visible:outline-slate-900 ' +
                ((selected ?? 0) >= score ? 'border-amber-500 bg-amber-50 text-amber-800' : 'text-slate-400')
              }>★</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.kind === 'saved' && <p role="status" className="font-medium">Thanks for your feedback.</p>}
      {(state.kind === 'retry' || state.kind === 'unavailable') && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      {!finished && (
        <div>
          <Button type="submit" variant="outline" disabled={!selected || state.kind === 'sending'}>
            {state.kind === 'sending' ? 'Submitting…' : state.kind === 'retry' ? 'Retry rating' : 'Submit rating'}
          </Button>
        </div>
      )}
    </form>
  )
}
