'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
  Newspaper,
  BookOpen,
  Square,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react'

/* ─── Presets ─────────────────────────────────────────────────────────── */
const PRESETS = [
  {
    id: 'noticias',
    label: 'Noticias',
    badge: '199:87',
    dimensions: '796 × 348 px',
    desc: 'Banner horizontal para noticias',
    Icon: Newspaper,
  },
  {
    id: 'ebooks',
    label: 'Ebooks / Recursos',
    badge: '4:3',
    dimensions: '1280 × 960 px',
    desc: 'Portadas de ebooks y recursos gratuitos',
    Icon: BookOpen,
  },
  {
    id: 'cuadrada',
    label: 'Cuadrada',
    badge: '1:1',
    dimensions: '1080 × 1080 px',
    desc: 'Redes sociales y publicaciones',
    Icon: Square,
  },
  {
    id: 'webp-only',
    label: 'Solo comprimir',
    badge: null,
    dimensions: 'Sin redimensionar',
    desc: 'Solo convierte a .webp y reduce el peso',
    Icon: Minimize2,
  },
  {
    id: 'manual',
    label: 'Personalizado',
    badge: 'custom',
    dimensions: 'Define el tamaño',
    desc: 'Ancho y alto a tu medida',
    Icon: SlidersHorizontal,
  },
]

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function formatBytes(b: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(2)} MB`
}

function reduction(from: number, to: number) {
  if (!from || !to) return ''
  return `${Math.round((1 - to / from) * 100)}% menos`
}

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Result {
  url: string
  originalSize: number
  outputSize: number
  quality: number
  fileName: string
}

/* ─── Component ───────────────────────────────────────────────────────── */
export default function Home() {
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [preset, setPreset]     = useState('noticias')
  const [manualW, setManualW]   = useState('1280')
  const [manualH, setManualH]   = useState('720')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<Result | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* ── File handling ── */
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG, WEBP, etc.)')
      return
    }
    if (f.size > 4 * 1024 * 1024) {
      setError('La imagen no puede superar 4 MB. Si es más grande, redúcela primero con una herramienta como squoosh.app.')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(f)
    })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  /* ── Process ── */
  const onProcess = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('image', file)
    fd.append('preset', preset)
    if (preset === 'manual') {
      fd.append('width', manualW)
      fd.append('height', manualH)
    }

    try {
      const res = await fetch('/api/process', { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = 'Error al procesar la imagen'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch {
          const text = await res.text().catch(() => '')
          if (res.status === 413 || text.toLowerCase().includes('entity too large')) {
            msg = 'La imagen es demasiado grande para el servidor. Usa una imagen de menos de 4 MB.'
          } else if (text) {
            msg = text
          }
        }
        throw new Error(msg)
      }
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const fileName = file.name.replace(/\.[^.]+$/, '') + '.webp'
      setResult({
        url,
        fileName,
        originalSize: parseInt(res.headers.get('X-Original-Size') ?? '0'),
        outputSize:   parseInt(res.headers.get('X-Output-Size')   ?? '0'),
        quality:      parseInt(res.headers.get('X-Quality-Used')  ?? '85'),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar')
    } finally {
      setLoading(false)
    }
  }

  /* ── Render ── */
  return (
    <main className="min-h-screen bg-[#F3F4FF]">

      {/* ── Header ── */}
      <header
        className="text-white py-10 px-4 text-center"
        style={{ background: 'linear-gradient(135deg, #704EFD 0%, #2CB7FF 100%)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="w-7 h-7" />
          <h1 className="text-3xl font-bold tracking-tight">Optimizador de Imágenes</h1>
        </div>
        <p className="text-white/80 text-sm">
          Redimensiona · Convierte a&nbsp;.webp · Máximo 100&nbsp;KB · Alta calidad
        </p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Upload zone ── */}
        <div
          role="button"
          tabIndex={0}
          className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer bg-white outline-none
            focus-visible:ring-2 focus-visible:ring-[#7D61F1]
            ${dragging  ? 'border-[#7D61F1] bg-[#DFD5FF]/30' :
              file      ? 'border-[#7D61F1]' :
                          'border-gray-200 hover:border-[#7D61F1]'}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="p-7 text-center">
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="vista previa"
                  className="max-h-48 mx-auto rounded-xl object-contain mb-3 shadow-sm"
                />
                <p className="text-sm font-semibold text-[#091E42]">{file?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatBytes(file?.size ?? 0)} · Clic para cambiar
                </p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-[#7D61F1] mx-auto mb-3" />
                <p className="font-semibold text-[#091E42]">
                  {dragging ? 'Suelta la imagen aquí' : 'Arrastra tu imagen aquí'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  o haz clic para seleccionar · JPG, PNG, WEBP · máx.&nbsp;4&nbsp;MB
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Presets ── */}
        <div>
          <h2 className="text-xs font-bold text-[#091E42] mb-3 uppercase tracking-widest">
            Formato de salida
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESETS.map(({ id, label, badge, dimensions, desc, Icon }) => {
              const active = preset === id
              return (
                <button
                  key={id}
                  onClick={() => setPreset(id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all focus:outline-none
                    focus-visible:ring-2 focus-visible:ring-[#7D61F1]
                    ${active
                      ? 'border-[#7D61F1] bg-[#DFD5FF]/50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#7D61F1] hover:shadow-sm'
                    }`}
                >
                  <Icon
                    className={`w-5 h-5 mb-2 ${active ? 'text-[#7D61F1]' : 'text-gray-400'}`}
                  />
                  <p className="font-semibold text-sm text-[#091E42]">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{dimensions}</p>
                  <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{desc}</p>
                  {badge && (
                    <span
                      className={`inline-block mt-1.5 text-xs rounded px-1.5 py-0.5 font-mono font-medium
                        ${active ? 'bg-[#7D61F1] text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Manual inputs ── */}
        {preset === 'manual' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#091E42] mb-4">Tamaño personalizado</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Ancho (px)', value: manualW, set: setManualW },
                { label: 'Alto (px)',  value: manualH, set: setManualH },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={e => set(e.target.value)}
                    min="1"
                    max="10000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                      focus:outline-none focus:border-[#7D61F1] focus:ring-1 focus:ring-[#7D61F1]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700
            rounded-xl p-4 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Process button ── */}
        <button
          onClick={onProcess}
          disabled={!file || loading}
          className="w-full py-3.5 rounded-xl font-semibold text-white transition-all
            flex items-center justify-center gap-2 shadow-sm
            disabled:bg-gray-300 disabled:cursor-not-allowed"
          style={!file || loading ? undefined : { background: 'linear-gradient(135deg, #704EFD 0%, #2CB7FF 100%)' }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Procesar imagen
            </>
          )}
        </button>

        {/* ── Result ── */}
        {result && (
          <div className="bg-white rounded-2xl border border-[#DFD5FF] shadow-sm overflow-hidden">
            {/* Result header */}
            <div className="px-5 py-3 flex items-center gap-2 bg-[#DFD5FF]/60">
              <CheckCircle className="w-5 h-5 text-[#7D61F1]" />
              <span className="font-semibold text-[#091E42]">Imagen lista para descargar</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.url}
                alt="resultado"
                className="w-full max-h-60 object-contain rounded-xl bg-[#F3F4FF]"
              />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Original"  value={formatBytes(result.originalSize)} />
                <Stat
                  label="Resultado"
                  value={formatBytes(result.outputSize)}
                  highlight={result.outputSize <= 100 * 1024 ? 'green' : 'amber'}
                />
                <Stat label="Reducción" value={reduction(result.originalSize, result.outputSize)} highlight="purple" />
              </div>

              {result.outputSize > 100 * 1024 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ La imagen pesa más de 100&nbsp;KB. Prueba el modo "Solo comprimir" o reduce las dimensiones.
                </p>
              )}

              {/* Download */}
              <a
                href={result.url}
                download={result.fileName}
                className="flex items-center justify-center gap-2 w-full py-3
                  text-white font-semibold rounded-xl transition-colors"
                style={{ background: 'linear-gradient(135deg, #704EFD 0%, #2CB7FF 100%)' }}
              >
                <Download className="w-4 h-4" />
                Descargar {result.fileName}
              </a>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Equipo de Comunicaciones · Las imágenes se procesan en el servidor y no se almacenan.
        </p>
      </div>
    </main>
  )
}

/* ── Small helper component ── */
function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'green' | 'amber' | 'purple'
}) {
  const colors = {
    green:  'text-green-600',
    amber:  'text-amber-600',
    purple: 'text-[#7D61F1]',
  }
  return (
    <div className="bg-[#F3F4FF] rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`font-bold text-sm ${highlight ? colors[highlight] : 'text-[#091E42]'}`}>
        {value}
      </p>
    </div>
  )
}
