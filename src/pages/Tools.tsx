import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitCompare } from 'lucide-react'
import { Banner, Button, PageHeader, RecommendationCard, Skeleton, Tabs, useToast } from '../ds'
import { useConsumer } from '../store'

export function Tools() {
  const nav = useNavigate()
  const toast = useToast()
  const { tools, toggleSave, setConfigTool, planId } = useConsumer()
  const [cat, setCat] = useState('all')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [])
  const shown = cat === 'all' ? tools : tools.filter((t) => t.category.toLowerCase().includes(cat))

  return (
    <div>
      <PageHeader
        title="Recommended tools"
        description="Ranked for your goals, budget and privacy needs. Open any card to see exactly why it ranks where it does."
        actions={
          <Button icon={<GitCompare size={14} />} onClick={() => nav('/app/compare')}>
            Compare
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="segmented"
          value={cat}
          onChange={setCat}
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'code', label: 'Code' },
            { value: 'writing', label: 'Writing' },
            { value: 'automation', label: 'Automation' },
          ]}
        />
        <p className="text-body-sm text-fg-muted">
          Total if you adopt all three: <span className="font-mono text-fg">~$40/mo</span> · over your $30 budget
        </p>
      </div>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="mt-4 h-16 w-full" />
              <Skeleton className="mt-4 h-9 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t, i) => (
            <RecommendationCard
              key={t.id}
              rec={t}
              rank={tools.indexOf(t) + 1}
              onToggleSave={() => {
                toggleSave(t.id)
                toast({ title: t.saved ? `Removed ${t.name}` : `Saved ${t.name}`, tone: 'success' })
              }}
              onConfigure={() => {
                setConfigTool(t.id)
                nav('/app/configure')
              }}
            />
          ))}
        </div>
      )}
      {planId === 'consumer-free' && (
        <div className="mt-8">
          <Banner title="2 more matches are available on Pro" action={<Button size="sm" onClick={() => nav('/app/upgrade')}>See Pro</Button>}>
            Including a lower-cost alternative that would keep you under budget.
          </Banner>
        </div>
      )}
    </div>
  )
}
