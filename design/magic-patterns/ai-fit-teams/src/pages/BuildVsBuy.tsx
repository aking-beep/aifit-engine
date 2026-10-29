import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button, EvidenceLabel, Slider, cn, formatRange } from '../ds'
import { BUILD_VS_BUY } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** Build vs buy: weighted criteria table; weights are editable and re-rank live. */
export function BuildVsBuy() {
  const nav = useNavigate()
  const [weights, setWeights] = useState([5, 4, 4, 2, 3, 2])
  const totals = BUILD_VS_BUY.options.map((o) => o.scores.reduce((s, v, i) => s + v * weights[i], 0))
  const max = Math.max(...weights) * 5 * weights.length
  const best = totals.indexOf(Math.max(...totals))
  return (
    <div>
      <WorkloadHeader
        stage="decide"
        title="Build versus buy"
        description="Scores are 1–5 per criterion. Adjust weights to match your priorities; the ranking updates immediately."
        actions={
          <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => nav('/app/cost')}>
            Model costs
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[640px] text-body-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-label-sm font-medium text-fg-muted">Criterion</th>
                <th className="px-4 py-3 text-left text-label-sm font-medium text-fg-muted">Weight</th>
                {BUILD_VS_BUY.options.map((o, i) => (
                  <th key={o.id} className={cn('px-4 py-3 text-left', i === best && 'bg-sunken')}>
                    {i === best && <span className="block text-label-sm font-medium text-accent">Recommended</span>}
                    <span className="text-label-md text-fg">{o.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUILD_VS_BUY.criteria.map((c, ci) => (
                <tr key={c} className="h-9 border-b border-line">
                  <td className="px-4 py-2 text-fg">{c}</td>
                  <td className="px-4 py-2 font-mono text-fg-muted">×{weights[ci]}</td>
                  {BUILD_VS_BUY.options.map((o, oi) => (
                    <td key={o.id} className={cn('px-4 py-2', oi === best && 'bg-sunken')}>
                      <span className="flex items-center gap-2">
                        <span className="flex gap-0.5" aria-hidden>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={cn('h-2 w-2 rounded-[1px]', n <= o.scores[ci] ? 'bg-fg' : 'bg-line-strong')} />
                          ))}
                        </span>
                        <span className="font-mono text-label-sm text-fg-muted">{o.scores[ci]}</span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-line">
                <td className="px-4 py-3 text-label-md text-fg">Year-1 cost</td>
                <td />
                {BUILD_VS_BUY.options.map((o, oi) => (
                  <td key={o.id} className={cn('px-4 py-3', oi === best && 'bg-sunken')}>
                    <span className="block font-mono text-fg">{formatRange(o.cost)}</span>
                    <EvidenceLabel kind={o.evidence} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3 text-label-md text-fg">Time to live</td>
                <td />
                {BUILD_VS_BUY.options.map((o, oi) => (
                  <td key={o.id} className={cn('px-4 py-3 font-mono text-fg', oi === best && 'bg-sunken')}>
                    {o.weeks} wks
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3 text-label-md text-fg">Weighted score</td>
                <td />
                {BUILD_VS_BUY.options.map((o, oi) => (
                  <td key={o.id} className={cn('px-4 py-3', oi === best && 'bg-sunken')}>
                    <span className="font-mono text-headline-md text-fg">{Math.round((totals[oi] / max) * 100)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <aside className="h-fit rounded-md border border-line bg-surface p-4">
          <p className="mb-4 text-title-md text-fg">Your priorities</p>
          <div className="flex flex-col gap-4">
            {BUILD_VS_BUY.criteria.map((c, i) => (
              <Slider key={c} label={c} value={weights[i]} min={0} max={5} onChange={(v) => setWeights(weights.map((w, j) => (j === i ? v : w)))} format={(v) => `×${v}`} />
            ))}
          </div>
          <p className="mt-4 text-body-sm text-fg-muted">Set “Control over data” and “Customisation” to ×5 and Hybrid overtakes Buy.</p>
        </aside>
      </div>
    </div>
  )
}
