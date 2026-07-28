import { useState, useRef } from 'react'
import { getRecords, downloadCsv, todayDateStr } from '../services/storageService'

export default function HistoryView({ onBack }) {
  const [query, setQuery] = useState('')
  const searchRef = useRef()

  const today = todayDateStr()
  const records = getRecords(today)
  const q = query.trim().toUpperCase()
  const filtered = q.length >= 2
    ? records.filter(r => r.id.includes(q))
    : records

  const buffered = records.filter(r => r.status === 'BUFFERED').length
  const alerts = records.filter(r => r.status === 'RUTEADO-ALERTA').length

  return (
    <div className="scanner-wrap">
      <div className="app-header">
        <div className="header-left">
          <button className="btn-icon" onClick={onBack} title="Volver al escáner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <div className="app-title">Historial de hoy</div>
            <div className="app-sub">
              {records.length === 0
                ? 'Sin registros hoy'
                : <><span style={{color:'var(--green)'}}>{buffered} buffered</span>{alerts > 0 && <> · <span style={{color:'var(--red-vivid)'}}>{alerts} alerta{alerts !== 1 ? 's' : ''}</span></>} · {records.length} total</>
              }
            </div>
          </div>
        </div>
        {records.length > 0 && (
          <div className="header-right">
            <button className="btn-link" onClick={() => downloadCsv(records, `cherry-picking-${today}.csv`)}>
              Descargar CSV
            </button>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="empty-state">No hay registros para hoy todavía.</div>
      ) : (
        <div className="scanner-main">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              className="search-input"
              type="text"
              placeholder="Buscar ID de paquete..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button className="search-clear" onClick={() => { setQuery(''); searchRef.current?.focus() }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          <div className="history">
            {q.length >= 2 && (
              <div className="history-header">
                {filtered.length === 0
                  ? `Sin resultados para "${q}"`
                  : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${q}"`}
              </div>
            )}
            {filtered.length === 0 && q.length >= 2 ? null : (
              <>
                {q.length < 2 && <div className="history-header">Todos los registros de hoy — {records.length} bipes</div>}
                {filtered.map((r, i) => (
                  <div key={i} className={`history-row${r.status === 'RUTEADO-ALERTA' ? ' history-row--ruteado' : ''}`}>
                    <span className="history-id">{r.id}</span>
                    <span className="history-meta">
                      {new Date(r.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {r.status}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
