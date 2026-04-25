'use client'
import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BenchmarkView } from '@/components/intelligence/BenchmarkView'
import { RunwaySimulator } from '@/components/intelligence/RunwaySimulator'
import { DocumentIntelligence } from '@/components/intelligence/DocumentIntelligence'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { BarChart3, Sliders, FileSearch } from 'lucide-react'

const TABS = [
  { id: 'benchmark', label: 'Peer Benchmarking', icon: BarChart3 },
  { id: 'runway', label: 'Runway Simulator', icon: Sliders },
  { id: 'documents', label: 'Document Intelligence', icon: FileSearch },
] as const

type TabId = typeof TABS[number]['id']

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<TabId>('benchmark')

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Intelligence Engine"
        subtitle="Gemma 4 · Snowflake Marketplace · Vision analysis"
      />
      <div className="p-6 space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-obsidian-800 rounded-xl border border-white/6 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'benchmark' && (
          <Card
            title="Peer Benchmarking"
            subtitle="Your spend vs comparable companies · Snowflake Marketplace + Cybersyn data"
          >
            <BenchmarkView />
          </Card>
        )}

        {activeTab === 'runway' && (
          <Card
            title="Runway Simulator"
            subtitle="Adjust variables — Gemma 4 explains the impact in plain English"
          >
            <RunwaySimulator />
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card
            title="Document Intelligence"
            subtitle="Upload invoices, contracts, or proposals — Gemma 4 Vision extracts and flags"
          >
            <DocumentIntelligence />
          </Card>
        )}
      </div>
    </div>
  )
}