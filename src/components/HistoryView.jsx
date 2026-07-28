import { useState, useRef } from 'react'
import { getAllDates, getRecords, downloadCsv } from '../services/storageService'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

export default function HistoryView({ onBack }) {
  const [query, setQuery] = useState('')
  const searchRef = useRef()
  const dates = getAllDates()

  const q = query.trim().toUpperCase()

  // Search mode: find all records matching the query across all dates
  const searchResults = q.length >= 2
    ? dates.flatMap(date =>
        getRecords(date)
          .filter(r => r.id.includes(q))
          .map(r => ({ ...r, date }))
      ).sort((a, b) => b.ts.localeCompare(a.ts))
    : null

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
            <div className="app-title">Historial</div>
            <div className="app-sub">
              {dates.length === 0 ? 'Sin registros' : `${dates.length} fecha${dates.length !== 1 ? 's' : ''} con registros`}
            </div>
          </div>
        </div>
      </div>

      {dates.length === 0 ? (
        <div className="empty-state">No hay registros guardados todavía.</div>
      ) : (
        <div className="scanner-main">

          {/* Search bar */}
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

          {/* Search results */}
          {searchResults !== null ? (
            <div className="history-date-card">
              <div className="history-date-header">
                <div>
                  <div className="history-date-label">
                    {searchResults.length === 0
                      ? `Sin resultados para "${q}"`
                      : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} para "${q}"`}
                  </div>
                </div>
              </div>
              {searchResults.length > 0 && (
                <div className="history-records">
                  {searchResults.map((r, i) => (
                    <div key={i} className={`history-row${r.status === 'RUTEADO-ALERTA' ? ' history-row--ruteado' : ''}`}>
                      <span className="history-id">{r.id}</span>
                      <span className="history-meta">
                        {formatDate(r.date)} {new Date(r.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Date list */
            dates.map(date => {
              const records = getRecords(date)
              const buffered = records.filter(r => r.status === 'BUFFERED').length
              const alerts = records.filter(r => r.status === 'RUTEADO-ALERTA').length
              return (
                <div key={date} className="history-date-card">
                  <div className="history-date-header">
                    <div>
                      <div className="history-date-label">{formatDate(date)}</div>
                      <div className="history-date-stats">
                        <span className="stat-chip stat-chip--green">{buffered} buffered</span>
                        {alerts > 0 && <span className="stat-chip stat-chip--red">{alerts} alerta{alerts !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <button
                      className="btn-link"
                      onClick={() => downloadCsv(records, `cherry-picking-${date}.csv`)}
                    >
                      Descargar CSV
                    </button>
                  </div>
                  <div className="history-records">
                    {records.slice(0, 6).map((r, i) => (
                      <div key={i} className={`history-row${r.status === 'RUTEADO-ALERTA' ? ' history-row--ruteado' : ''}`}>
                        <span className="history-id">{r.id}</span>
                        <span className="history-meta">
                          {new Date(r.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {r.status}
                        </span>
                      </div>
                    ))}
                    {records.length > 6 && (
                      <div className="history-more">+{records.length - 6} registros más — descarga el CSV para ver todos</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
