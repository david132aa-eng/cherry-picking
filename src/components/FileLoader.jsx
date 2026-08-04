import { useRef, useState } from 'react'

const HEADER_RE = /^(shipment|envio|envío|id|paquete|package|columna|column|detalle|estado|fecha|date|ruta|route|grupo|group)$/i

export function parseIdsWithRoutes(text) {
  const routeMap = new Map()
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/[\s,;]+/)
    const id = parts[0]?.trim().toUpperCase()
    if (!id || id.length < 3 || HEADER_RE.test(id)) continue
    routeMap.set(id, parts[1]?.trim().toUpperCase() || '')
  }
  return routeMap
}

// Backward-compat export used in Scanner for count display
export function parseIds(text) {
  return new Set(parseIdsWithRoutes(text).keys())
}

export default function FileLoader({ onLoad }) {
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef()

  const processText = (text, name) => {
    const routeMap = parseIdsWithRoutes(text)
    if (routeMap.size > 0) onLoad(routeMap, name)
  }

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => processText(e.target.result, file.name)
    reader.readAsText(file, 'UTF-8')
  }

  const pasteCount = parseIdsWithRoutes(pasteText).size

  return (
    <div className="file-loader">
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 12 15 15"/>
        </svg>
        <span className="drop-label">Arrastra un archivo CSV o haz clic para seleccionar</span>
        <span className="drop-hint">Columna 1: Shipment ID · Columna 2: Grupo de ruta (AB, CD…)</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
        />
      </div>

      <div className="paste-toggle">
        <button className="btn-text" onClick={() => setPasting(!pasting)}>
          {pasting ? 'Cancelar' : 'O pega la lista directamente'}
        </button>
      </div>

      {pasting && (
        <div className="paste-area">
          <textarea
            className="paste-textarea"
            placeholder={'Formato: ID,Ruta (una por línea)\nCE47120890002,AB\nCE47120890003,CD\n...\nO solo IDs sin ruta'}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={7}
            autoFocus
          />
          <button
            className="btn-primary"
            disabled={pasteCount === 0}
            onClick={() => {
              processText(pasteText, `Lista pegada (${pasteCount} IDs)`)
              setPasteText('')
              setPasting(false)
            }}
          >
            {pasteCount > 0 ? `Cargar ${pasteCount} IDs` : 'Pega IDs arriba'}
          </button>
        </div>
      )}
    </div>
  )
}
