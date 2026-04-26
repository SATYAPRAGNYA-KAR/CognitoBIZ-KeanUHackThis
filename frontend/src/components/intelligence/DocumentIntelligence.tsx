'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { DocumentExtraction } from '@/types'

const MOCK_RESULT: DocumentExtraction = {
  _id: 'doc-1',
  filename: 'acme_invoice_april.pdf',
  type: 'invoice',
  uploadedAt: new Date().toISOString(),
  extractedData: {
    vendor: 'Acme Corp', amount: 2400, dueDate: new Date(Date.now() + 2592000000).toISOString(),
    paymentTerms: 'Net 30',
    flags: ['Auto-renewal clause detected in §4.2', 'Late payment penalty: 1.5%/month'],
  },
  gemmaSummary: 'Invoice from Acme Corp for $2,400 due May 1st. Terms are standard Net 30. Two flags: an auto-renewal clause in section 4.2 that rolls over for 12 months unless cancelled 30 days prior, and a late payment penalty of 1.5% per month. Recommend reviewing the renewal clause before the deadline.',
  status: 'extracted',
}

export function DocumentIntelligence() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DocumentExtraction | null>(null)

  // const handleFile = async (file: File) => {
  //   setLoading(true)
  //   await new Promise(r => setTimeout(r, 2200)) // simulate Gemma vision call
  //   setResult(MOCK_RESULT)
  //   setLoading(false)
  //   toast.success('Document analyzed by Gemma 4')
  // }
  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', 'invoice') // default, could be made selectable

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_URL}/api/intelligence/analyze-document`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary for multipart
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Analysis failed')
      }

      const data = await res.json()

      setResult({
        _id: data.document_id,
        filename: data.filename,
        type: data.doc_type,
        uploadedAt: new Date().toISOString(),
        extractedData: {
          vendor: data.extracted?.vendor,
          amount: data.extracted?.amount,
          dueDate: data.extracted?.due_date,
          paymentTerms: data.extracted?.payment_terms,
          flags: data.flags || [],
        },
        gemmaSummary: data.summary || '',
        status: 'extracted',
      })
      toast.success('Document analyzed by Gemma!')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {!loading && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('doc-upload')?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-gold-400/50 bg-gold-400/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'}`}
        >
          <input id="doc-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <Upload size={28} className="mx-auto text-gray-600 mb-3" />
          <div className="text-sm text-gray-400 font-medium">Drop invoice, contract or proposal</div>
          <div className="text-xs text-gray-600 mt-1">PDF, PNG or JPG · Gemma 4 Vision reads it</div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10">
          <Loader2 size={28} className="animate-spin text-gold-400 mx-auto mb-3" />
          <div className="text-sm text-gray-400">Gemma 4 is reading your document…</div>
          <div className="text-xs text-gray-600 mt-1">Extracting entities, flags, and action items</div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sapphire-400/10 border border-sapphire-400/20 flex items-center justify-center">
                  <FileText size={14} className="text-sapphire-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{result.filename}</div>
                  <Badge variant="sapphire" className="text-[9px]">{result.type}</Badge>
                </div>
              </div>
              <button onClick={() => setResult(null)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            {/* Extracted fields */}
            <div className="grid grid-cols-2 gap-3">
              {result.extractedData.vendor && (
                <div className="bg-obsidian-800 rounded-xl px-3 py-2.5 border border-white/6">
                  <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Vendor</div>
                  <div className="text-sm text-white">{result.extractedData.vendor}</div>
                </div>
              )}
              {result.extractedData.amount && (
                <div className="bg-obsidian-800 rounded-xl px-3 py-2.5 border border-white/6">
                  <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Amount</div>
                  <div className="text-sm text-jade-400 font-mono">{formatCurrency(result.extractedData.amount as number)}</div>
                </div>
              )}
              {result.extractedData.dueDate && (
                <div className="bg-obsidian-800 rounded-xl px-3 py-2.5 border border-white/6">
                  <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Due Date</div>
                  <div className="text-sm text-white">{formatDate(result.extractedData.dueDate as string)}</div>
                </div>
              )}
              {result.extractedData.paymentTerms && (
                <div className="bg-obsidian-800 rounded-xl px-3 py-2.5 border border-white/6">
                  <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Terms</div>
                  <div className="text-sm text-white">{result.extractedData.paymentTerms}</div>
                </div>
              )}
            </div>

            {/* Flags */}
            {(result.extractedData.flags as string[])?.length > 0 && (
              <div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">⚠️ Flags</div>
                {(result.extractedData.flags as string[]).map((flag, i) => (
                  <div key={i} className="flex items-center gap-2 bg-ember-400/8 border border-ember-400/15 rounded-lg px-3 py-2 mb-1.5">
                    <AlertTriangle size={11} className="text-ember-400 shrink-0" />
                    <span className="text-[11px] text-ember-400/80">{flag}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gemma summary */}
            <div className="bg-obsidian-800 rounded-xl p-4 border border-white/6">
              <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Gemma Summary</div>
              <p className="text-xs text-gray-300 leading-relaxed">{result.gemmaSummary}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>Upload Another</Button>
              <Button size="sm" variant="primary">Add to Payment Queue</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}