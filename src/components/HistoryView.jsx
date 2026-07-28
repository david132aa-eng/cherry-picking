import { getAllDates, getRecords, downloadCsv } from '../services/storageService'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

export default function HistoryView({ onBack }) {
  const dates = getAllDates()

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
          {dates.map(date => {
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
                {records.length > 0 && (
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
