import type { EngagementRange, EngagementReport } from '@exitslide/contracts'
import type { ReactNode } from 'react'
import type { Result } from '../server/backend'
import { Button } from './ui/button'

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const number = new Intl.NumberFormat('en')

export function EngagementReportPanel({ report, range, path, cursor }: {
  report: Result<EngagementReport>
  range: EngagementRange
  path: string
  cursor?: string
}) {
  return (
    <section className="surface grid min-w-0 gap-5 p-4 sm:p-6" aria-labelledby="engagement-heading">
      <h2 id="engagement-heading" className="text-xl font-semibold tracking-tight">Engagement</h2>
      <form action={path} method="get" className="flex flex-wrap items-end gap-3">
        {cursor && <input type="hidden" name="cursor" value={cursor} />}
        <label className="grid gap-1.5 text-sm font-medium">
          From (UTC)
          <input type="date" name="from" defaultValue={range.from} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Through (UTC)
          <input type="date" name="to" defaultValue={range.to} />
        </label>
        <Button type="submit" variant="outline">Apply dates</Button>
        {(range.from || range.to) && <a href={path + (cursor ? '?cursor=' + cursor : '')}
          className="app-link inline-flex min-h-11 items-center text-sm">Clear dates</a>}
      </form>
      {!report.ok ? <p role="alert" className="text-red-700">{report.message}</p> : (
        <>
          <dl className="grid max-w-xl grid-cols-2 gap-3">
            <div className="grid gap-1 rounded-xl bg-slate-50 p-3 sm:p-4">
              <dt className="text-sm font-medium text-slate-600">Page visits</dt>
              <dd className="text-2xl font-semibold tabular-nums">{number.format(report.data.totals.visits)}</dd>
            </div>
            <div className="grid gap-1 rounded-xl bg-slate-50 p-3 sm:p-4">
              <dt className="text-sm font-medium text-slate-600">Get slides clicks</dt>
              <dd className="text-2xl font-semibold tabular-nums">{number.format(report.data.totals.slideClicks)}</dd>
            </div>
          </dl>
          {report.data.days.length === 0 ? <p className="text-sm text-slate-600">No activity in this date range.</p> : (
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <Breakdown label="Daily activity (UTC)" dimension="Date" rows={report.data.days.map(day => ({
                ...day, label: <time dateTime={day.date}>{day.date}</time>, key: day.date,
              }))} />
              {report.data.countries.length ? <Breakdown label="Activity by country" dimension="Country" rows={report.data.countries.map(row => ({
                ...row, label: countryNames.of(row.country), key: row.country,
              }))} /> : <p className="self-start text-sm text-slate-600">Country data is unavailable for this activity.</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Breakdown({ label, dimension, rows }: {
  label: string
  dimension: string
  rows: Array<{ key: string; label: ReactNode; visits: number; slideClicks: number }>
}) {
  return (
    <table className="w-full self-start text-sm">
      <caption className="pb-2 text-left font-semibold">{label}</caption>
      <thead className="border-b border-border text-slate-600">
        <tr>
          <th scope="col" className="py-2 text-left">{dimension}</th>
          <th scope="col" className="py-2 pl-2 text-right">Visits</th>
          <th scope="col" className="py-2 pl-2 text-right">Slide clicks</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map(row => (
          <tr key={row.key}>
            <th scope="row" className="py-2 text-left font-medium">{row.label}</th>
            <td className="py-2 pl-2 text-right tabular-nums">{number.format(row.visits)}</td>
            <td className="py-2 pl-2 text-right tabular-nums">{number.format(row.slideClicks)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
