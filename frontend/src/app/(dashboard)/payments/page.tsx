'use client'
import { TopBar } from '@/components/layout/TopBar'
import { PaymentQueue } from '@/components/payments/PaymentQueue'
import { Card } from '@/components/ui/Card'

export default function PaymentsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Payment Queue"
        subtitle="HITL-gated · Solana escrow execution · Every approval is logged"
      />
      <div className="p-6">
        <Card
          title="Pending Approvals"
          subtitle="All payments require owner sign-off before Solana execution"
        >
          <PaymentQueue />
        </Card>
      </div>
    </div>
  )
}