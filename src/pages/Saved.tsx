import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { Button, EmptyState, PageHeader, RecommendationCard } from '../ds'
import { useConsumer } from '../store'

export function Saved() {
  const nav = useNavigate()
  const { allTools, toggleSave, setConfigTool } = useConsumer()
  const saved = allTools.filter((t) => t.saved)
  return (
    <div>
      <PageHeader title="Saved recommendations" description="Tools you’re considering. We’ll tell you if pricing or privacy terms change." />
      {saved.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={22} strokeWidth={1.5} />}
          title="Nothing saved yet"
          description="Save a recommendation to keep it here and get notified when its pricing or privacy terms change."
          action={
            <Button variant="primary" onClick={() => nav('/app/tools')}>
              Browse recommendations
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {saved.map((t) => (
            <RecommendationCard
              key={t.id}
              rec={t}
              onToggleSave={() => toggleSave(t.id)}
              onConfigure={() => {
                setConfigTool(t.id)
                nav('/app/configure')
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
