import { useRef, useState } from 'react'

function parseIds(text) {
  const ids = new Set()
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const parts = line.split(/[,;\t]/)
    for (const part of parts) {
      const id = part.trim().toUpperCase()
      if (id.length >= 3 && !/^(shipment|envio|envío|id|paquete|package|columna|column|detalle|estado|fecha|date)$/i.test(id)) {
        ids.add(id)
      }
    }
  }
  return ids
}

export { parseIds }

export default function FileLoader({ onLoad }) {
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef()

  const processText = (text, name) => {
    const ids = parseIds(text)
    if (ids.size > 0) onLoad(ids, name)
  }

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => processText(e.target.result, file.name)
    reader.readAsText(file, 'UTF-8')
  }

  const pasteIds = parseIds(pasteText)

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
        <span className="drop-hint">Archivo con los Shipment IDs de paquetes ruteados</span>
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
          {pasting ? 'Cancelar' : 'O pega la lista de IDs directamente'}
        </button>
      </div>

      {pasting && (
        <div className="paste-area">
          <textarea
            className="paste-textarea"
            placeholder={'Pega aquí los IDs, uno por línea (o en CSV):\nABC123\nDEF456\n...'}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={7}
            autoFocus
          />
          <button
            className="btn-primary"
            disabled={pasteIds.size === 0}
            onClick={() => {
              processText(pasteText, `Lista pegada (${pasteIds.size} IDs)`)
              setPasteText('')
              setPasting(false)
            }}
          >
            {pasteIds.size > 0 ? `Cargar ${pasteIds.size} IDs` : 'Pega IDs arriba'}
          </button>
        </div>
      )}
    </div>
  )
}
