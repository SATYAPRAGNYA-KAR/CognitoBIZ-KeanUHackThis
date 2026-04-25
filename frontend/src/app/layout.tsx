import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian-950 bg-grid flex">
      <Sidebar />
      <main className="flex-1 pl-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}