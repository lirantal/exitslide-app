import { sessionInputSchema, type SessionInput } from '@exitslide/contracts'
import { useId, useState, type FormEvent } from 'react'
import { Button } from './ui/button'

export function SessionForm({
  initial = { title: '', slideUrl: '' },
  label,
  onSave,
}: {
  initial?: SessionInput
  label: string
  onSave(input: SessionInput): Promise<string | undefined>
}) {
  const fieldId = useId()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const fields = new FormData(event.currentTarget)
    const input = sessionInputSchema.safeParse({
      title: fields.get('title'),
      slideUrl: fields.get('slideUrl'),
    })
    setSaved(false)
    if (!input.success) {
      setMessage('Enter a title and a valid HTTPS slide URL.')
      return
    }

    setMessage('')
    setPending(true)
    try {
      const error = await onSave(input.data)
      if (error) setMessage(error)
      else setSaved(true)
    } catch {
      setMessage('Couldn’t save the Session. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label htmlFor={fieldId + '-title'} className="grid gap-1.5 text-sm font-medium">
        Session title
        <input id={fieldId + '-title'} name="title" required maxLength={160} defaultValue={initial.title} />
      </label>
      <label htmlFor={fieldId + '-url'} className="grid gap-1.5 text-sm font-medium">
        Slide URL
        <input id={fieldId + '-url'} name="slideUrl" type="url" required maxLength={2048}
          placeholder="https://…" defaultValue={initial.slideUrl} />
      </label>
      <div><Button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</Button></div>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {saved && <p role="status" className="text-sm text-slate-600">Changes saved.</p>}
    </form>
  )
}
