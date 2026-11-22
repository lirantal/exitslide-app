import { sessionInputSchema, type SessionInput } from '@exitslide/contracts'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from './ui/button'

type SessionField = keyof SessionInput

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
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SessionField, string>>>({})
  const fieldToFocus = useRef<HTMLInputElement | null>(null)

  useEffect(() => setReady(true), [])
  useEffect(() => {
    fieldToFocus.current?.focus()
    fieldToFocus.current = null
  }, [fieldErrors])

  function clearFieldError(field: SessionField, event: FormEvent<HTMLInputElement>) {
    if (fieldErrors[field] && sessionInputSchema.shape[field].safeParse(event.currentTarget.value).success) {
      setFieldErrors(errors => ({ ...errors, [field]: undefined }))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || pending) return
    const fields = new FormData(event.currentTarget)
    const input = sessionInputSchema.safeParse({
      title: fields.get('title'),
      slideUrl: fields.get('slideUrl'),
    })
    setSaved(false)
    setMessage('')
    if (!input.success) {
      const title = input.error.issues.find(issue => issue.path[0] === 'title')?.message
      const slideUrl = input.error.issues.some(issue => issue.path[0] === 'slideUrl')
        ? 'Enter a valid HTTPS slide URL without embedded credentials.'
        : undefined
      const firstInvalid = event.currentTarget.elements.namedItem(title ? 'title' : 'slideUrl')
      if (firstInvalid instanceof HTMLInputElement) fieldToFocus.current = firstInvalid
      setFieldErrors({ title, slideUrl })
      return
    }

    setFieldErrors({})
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
    <form method="post" onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5 text-sm">
        <label htmlFor={fieldId + '-title'} className="font-medium">Session title</label>
        <input id={fieldId + '-title'} name="title" required maxLength={160} defaultValue={initial.title}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? fieldId + '-title-error' : undefined}
          onInput={event => clearFieldError('title', event)} />
        {fieldErrors.title && <p id={fieldId + '-title-error'} className="text-red-700">{fieldErrors.title}</p>}
      </div>
      <div className="grid gap-1.5 text-sm">
        <label htmlFor={fieldId + '-url'} className="font-medium">Slide URL</label>
        <input id={fieldId + '-url'} name="slideUrl" type="url" required maxLength={2048}
          placeholder="https://…" defaultValue={initial.slideUrl} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-invalid={fieldErrors.slideUrl ? true : undefined}
          aria-describedby={fieldErrors.slideUrl ? fieldId + '-url-error' : undefined}
          onInput={event => clearFieldError('slideUrl', event)} />
        {fieldErrors.slideUrl && <p id={fieldId + '-url-error'} className="text-red-700">{fieldErrors.slideUrl}</p>}
      </div>
      <div><Button type="submit" disabled={!ready || pending}>{pending ? 'Saving…' : label}</Button></div>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {saved && <p role="status" className="text-sm text-slate-600">Changes saved.</p>}
    </form>
  )
}
