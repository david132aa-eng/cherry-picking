import { useState, useEffect, useRef, useMemo } from 'react'
import { playSuccess } from '../services/audioService'
import {
  todayDateStr, downloadCsv,
  subscribeToTodayRoutes,
  saveReinjectToFirestore, subscribeToReinjections,
} from '../services/storageService'

const KNOWN_GROUPS = ['AB', 'CD', 'FG', 'HI', 'JK', 'LM', 'NP', 'QR', 'ST', 'UV', 'WX', 'YZ']

export default function ReinjectView({ onBack }) {
  const [routeMap, setRouteMap] = useState(null)
  const [syncLoading, setSyncLoading] = useState(true)
  const [inputVal, setInputVal] = useState('')
  const [reinjections, setReinjections] = useState([])
  const [sessionId] = useState('R-' + Date.now().toString(36).toUpperCase())
  const inputRef = useRef()

  // Shared routing base from Firestore
  useEffect(() => {
    const timeout = setTimeout(() => setSyncLoading(false), 5000)
    const unsub = subscribeToTodayRoutes((data) => {
      clearTimeout(timeout)
      setSyncLoading(false)
      if (data) setRouteMap(data.routeMap)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])

  // Real-time reinjections from Firestore
  useEffect(() => {
    return subscribeToReinjections(records => setReinjections(records))
  }, [])

  useEffect(() => {
    if (!syncLoading) setTimeout(() => inputRef.current?.focus(), 100)
  }, [syncLoading])

  const processScan = (id) => {
    const route = routeMap?.get(id) || 'SIN RUTA'
    const record = { ts: new Date().toISOString(), id, route, session: sessionId }
    saveReinjectToFirestore(record).catch(() => {})
    setReinjections(prev => [record, ...prev])
    playSuccess()
  }

  const handleChange = (e) => {
    const val = e.target.value
    if (/\s$/.test(val)) {
      const id = val.trim().toUpperCase()
      setInputVal('')
      if (id) processScan(id)
    } else {
      setInputVal(val)
    }
  }

  const handleScan = (e) => {
    e.preventDefault()
    const id = inputVal.trim().toUpperCase()
    if (!id) return
    setInputVal('')
    processScan(id)
  }

  const handleDownload = () => {
    const rows = reinjections.map(r => ({ ...r, status: r.route }))
    downloadCsv(rows, `reinyeccion-${todayDateStr()}.csv`)
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  const { groupCounts, allGroups, maxCount } = useMemo(() => {
    const counts = new Map()
    for (const r of reinjections) {
      const g = r.route || 'SIN RUTA'
      counts.set(g, (counts.get(g) || 0) + 1)
    }
    const knownWithData = KNOWN_GROUPS.filter(g => counts.has(g))
    const unknownGroups = [...counts.keys()]
      .filter(g => !KNOWN_GROUPS.includes(g) && g !== 'SIN RUTA')
      .sort()
    const noRoute = counts.has('SIN RUTA') ? ['SIN RUTA'] : []
    return {
      groupCounts: counts,
      allGroups: [...knownWithData, ...unknownGroups, ...noRoute],
      maxCount: Math.max(1, ...counts.values()),
    }
  }, [reinjections])

  // Top group for highlight
  const topGroup = allGroups.length > 0
    ? allGroups.reduce((a, b) => (groupCounts.get(a) >= groupCounts.get(b) ? a : b), allGroups[0])
    : null

  return (
    <div className="scanner-wrap">
      <div className="app-header">
        <div className="header-left">
          <button className="btn-icon" onClick={onBack} title="Volver a Cherry Picking">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <div className="app-title">Reinyección SAN1</div>
            <div className="app-sub">
              {reinjections.length === 0
                ? 'Sin reinyecciones hoy'
                : `${reinjections.length} reinyección${reinjections.length !== 1 ? 'es' : ''} hoy${topGroup && topGroup !== 'SIN RUTA' ? ` · Mayor reflujo: ${topGroup}` : ''}`
              }
            </div>
          </div>
        </div>
        <div className="header-right">
          {reinjections.length > 0 && (
            <button className="btn-link" onClick={handleDownload}>CSV</button>
          )}
        </div>
      </div>

      {syncLoading ? (
        <div className="scanner-main">
          <div className="scan-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="sync-spinner" />
            <p className="scan-hint" style={{ marginTop: '1rem' }}>Cargando base de ruteados…</p>
          </div>
        </div>
      ) : (
        <div className="scanner-main">
          {!routeMap && (
            <div className="reinject-warning">
              Sin base de ruteados cargada hoy — los paquetes se registrarán sin grupo de ruta.
              Carga la base en Cherry Picking primero.
            </div>
          )}

          <div className="scan-card">
            <label className="scan-label">Escanea el paquete reinyectado</label>
            <form onSubmit={handleScan}>
              <input
                ref={inputRef}
                className="scan-input"
                value={inputVal}
                onChange={handleChange}
                placeholder="ID del paquete..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </form>
            <p className="scan-hint">
              Bipa el paquete · registra automáticamente
              {routeMap ? ` · ${routeMap.size} IDs en base` : ''}
            </p>
          </div>

          {/* ── Dashboard ── */}
          {allGroups.length > 0 && (
            <div className="scan-card">
              <div className="dashboard-header">
                <span className="dashboard-title">Reflujo por grupo de letras</span>
                <span className="dashboard-total">{reinjections.length} total</span>
              </div>
              <div className="group-bars">
                {allGroups.map(g => {
                  const count = groupCounts.get(g)
                  const pct = (count / maxCount) * 100
                  const isTop = g === topGroup && g !== 'SIN RUTA'
                  return (
                    <div key={g} className={`group-bar-row${isTop ? ' group-bar-row--top' : ''}`}>
                      <span className="group-bar-label">{g}</span>
                      <div className="group-bar-track">
                        <div
                          className="group-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="group-bar-count">{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Known groups with 0 — shown faded */}
              {KNOWN_GROUPS.filter(g => !groupCounts.has(g)).length > 0 && (
                <div className="group-zero-row">
                  Sin datos: {KNOWN_GROUPS.filter(g => !groupCounts.has(g)).join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* ── Recent list ── */}
          {reinjections.length > 0 && (
            <div className="history">
              <div className="history-header">
                Reinyecciones de hoy — todos los dispositivos ({reinjections.length})
              </div>
              {reinjections.map((r, i) => (
                <div key={i} className={`history-row${r.route === 'SIN RUTA' ? ' history-row--ruteado' : ''}`}>
                  <span className="history-id">{r.id}</span>
                  <span className="history-meta">
                    {new Date(r.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {' · '}
                    <span className="reinject-route">{r.route}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="session-id">Sesión: {sessionId}</div>
        </div>
      )}
    </div>
  )
}
