'use client'

import React from 'react'
import type { CostLine } from './types'
import { EvidenceLabel } from './Evidence'
import { formatMoney, formatRange } from './lib'

/**
 * Cost table: line, driver, monthly range, evidence. Totals sum ranges and
 * are labelled estimated whenever any line is not verified.
 * Stacks into rows below md.
 */
export function CostTable({ lines, currency = 'USD' }: { lines: CostLine[]; currency?: string }) {
  const low = lines.reduce((s, l) => s + l.monthly.low, 0)
  const high = lines.reduce((s, l) => s + l.monthly.high, 0)
  const allVerified = lines.every((l) => l.evidence === 'verified')
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <table className="w-full text-body-sm">
        <thead className="hidden bg-sunken text-left md:table-header-group">
          <tr className="text-label-sm text-fg-muted">
            <th className="px-4 py-2 font-medium">Line item</th>
            <th className="px-4 py-2 font-medium">Cost driver</th>
            <th className="px-4 py-2 font-medium">Evidence</th>
            <th className="px-4 py-2 text-right font-medium">Monthly</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="grid grid-cols-[1fr_auto] gap-1 border-t border-line px-4 py-3 first:border-t-0 md:table-row md:p-0">
              <td className="md:px-4 md:py-2.5">
                <span className="text-fg">{l.label}</span>
                <span className="block text-label-sm text-fg-muted">{l.category}</span>
              </td>
              <td className="order-3 col-span-2 text-fg-muted md:px-4 md:py-2.5">{l.driver}</td>
              <td className="order-4 col-span-2 md:px-4 md:py-2.5">
                <EvidenceLabel kind={l.evidence} />
              </td>
              <td className="order-2 text-right font-mono text-fg tabular md:px-4 md:py-2.5">{formatRange({ ...l.monthly, per: undefined })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="flex items-center justify-between border-t border-line-strong bg-sunken px-4 py-3 md:table-row md:p-0">
            <td className="text-label-md text-fg md:px-4 md:py-3" colSpan={2}>
              Total per month
            </td>
            <td className="hidden md:table-cell md:px-4 md:py-3">
              <EvidenceLabel kind={allVerified ? 'verified' : 'estimated'} />
            </td>
            <td className="text-right font-mono text-label-md text-fg tabular md:px-4 md:py-3">
              {formatMoney(low, currency)}–{formatMoney(high, currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
