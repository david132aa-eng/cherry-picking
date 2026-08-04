import { useState, useEffect, useRef, useMemo } from 'react'
import { playSuccess } from '../services/audioService'
import {
  todayDateStr, downloadCsv,
  subscribeToTodayRoutes, syncRoutesToFirestore,
  saveReinjectToFirestore, subscribeToReinjections,
} from '../services/storageService'
import FileLoader from './FileLoader'

const KNOWN_GROUPS = ['AB', 'CD', 'FG', 'HI', 'JK', 'LM', 'NP', 'QR', 'ST', 'UV', 'WX', 'YZ']

// Derives letter group from first character of route code (e.g. 'V2_AM2' → 'UV')
const LETTER_TO_GROUP = {
  A: 'AB', B: 'AB',
  C: 'CD', D: 'CD',
  F: 'FG', G: 'FG',
  H: 'HI', I: 'HI',
  J: 'JK', K: 'JK',
  L: 'LM', M: 'LM',
  N: 'NP', P: 'NP',
  Q: 'QR', R: 'QR',
  S: 'ST', T: 'ST',
  U: 'UV', V: 'UV',
  W: 'WX', X: 'WX',
  Y: 'YZ', Z: 'YZ',
}

function getLetterGroup(rawRoute) {
  if (!rawRoute) return 'ETIQUETA BLANCA'
  let cleaned = rawRoute.trim()
  const hasPrefix = cleaned.startsWith('>')
  if (hasPrefix) cleaned = cleaned.slice(1)
  const first = cleaned.charAt(0).toUpperCase()
  const group = LETTER_TO_GROUP[first] || 'ETIQUETA BLANCA'
  return hasPrefix && group !== 'ETIQUETA BLANCA' ? `>${group}` : group
}

// Shared with Scanner — same localStorage key so one load serves both modules
const ROUTES_KEY = () => 'cp_routes_' + todayDateStr()

function loadLocalRoutes() {
  try {
    const raw = localStorage.getItem(ROUTES_KEY())
    if (!raw) return null
    const data = JSON.parse(raw)
    return new Map(Object.entries(data.routeMap || {}))
  } catch { return null }
}

function saveLocalRoutes(routeMap, name) {
  localStorage.setItem(ROUTES_KEY(), JSON.stringify({
    ids: [...routeMap.keys()],
    name,
    routeMap: Object.fromEntries(routeMap),
  }))
}

export default function ReinjectView({ onBack }) {
  const savedLocal = loadLocalRoutes()
  const [routeMap, setRouteMap] = useState(savedLocal)
  const [syncLoading, setSyncLoading] = useState(!savedLocal)
  const [inputVal, setInputVal] = useState('')
  const [reinjections, setReinjections] = useState([])
  const [sessionId] = useState('R-' + Date.now().toString(36).toUpperCase())
  const inputRef = useRef()

  // Shared routing base from Firestore — same doc that Cherry Picking writes
  useEffect(() => {
    const timeout = setTimeout(() => setSyncLoading(false), 5000)
    const unsub = subscribeToTodayRoutes((data) => {
      clearTimeout(timeout)
      setSyncLoading(false)
      if (data) {
        const incomingHasRoutes = [...data.routeMap.values()].some(v => v.length > 0)
        // Only override local data if Firestore actually has routes
        if (incomingHasRoutes) {
          setRouteMap(data.routeMap)
          saveLocalRoutes(data.routeMap, data.name || '')
        } else if (!savedLocal) {
          setRouteMap(data.routeMap)
        }
      }
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

  const handleLoad = (newRouteMap, name) => {
    setRouteMap(newRouteMap)
    saveLocalRoutes(newRouteMap, name)
    syncRoutesToFirestore(newRouteMap, name).catch(() => {})
  }

  const processScan = (id) => {
    const rawRoute = routeMap?.get(id)          // undefined | '' | 'V2_AM2'
    const route = getLetterGroup(rawRoute)       // 'UV' | 'ETIQUETA BLANCA'
    const record = {
      ts: new Date().toISOString(),
      id,
      route,
      rawRoute: rawRoute || '',
      session: sessionId,
    }
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
    const rows = reinjections.map(r => ({
      ...r,
      status: r.route,
      session: r.session,
    }))
    downloadCsv(rows, `reinyeccion-${todayDateStr()}.csv`)
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  const { groupCounts, allGroups, maxCount } = useMemo(() => {
    const counts = new Map()
    for (const r of reinjections) {
      // normalize legacy 'SIN RUTA' records to 'ETIQUETA BLANCA'
      const g = (!r.route || r.route === 'SIN RUTA') ? 'ETIQUETA BLANCA' : r.route
      counts.set(g, (counts.get(g) || 0) + 1)
    }
    const knownWithData = KNOWN_GROUPS.filter(g => counts.has(g))
    const unknownGroups = [...counts.keys()]
      .filter(g => !KNOWN_GROUPS.includes(g) && g !== 'ETIQUETA BLANCA')
      .sort()
    const etBlanca = counts.has('ETIQUETA BLANCA') ? ['ETIQUETA BLANCA'] : []
    return {
      groupCounts: counts,
      allGroups: [...knownWithData, ...unknownGroups, ...etBlanca],
      maxCount: Math.max(1, ...counts.values()),
    }
  }, [reinjections])

  const routableGroups = allGroups.filter(g => g !== 'ETIQUETA BLANCA')
  const topGroup = routableGroups.length > 0
    ? routableGroups.reduce((a, b) => (groupCounts.get(a) >= groupCounts.get(b) ? a : b))
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
                : `${reinjections.length} reinyección${reinjections.length !== 1 ? 'es' : ''} hoy${topGroup ? ` · Mayor reflujo: ${topGroup}` : ''}`
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
          {(!routeMap || ![...routeMap.values()].some(v => v.length > 0)) && (
            <div className="scan-card">
              <p className="scan-label" style={{ marginBottom: '0.75rem' }}>
                {!routeMap
                  ? 'Carga la base de paquetes (ID · Ruta) para registrar grupos de letras'
                  : '⚠️ La base no tiene rutas. Carga el CSV con dos columnas: ID y Ruta'}
              </p>
              <FileLoader onLoad={handleLoad} />
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
              {topGroup && (
                <div className="top-group-banner">
                  <div className="top-group-pill">{topGroup}</div>
                  <div className="top-group-info">
                    <span className="top-group-label">Mayor reflujo</span>
                    <span className="top-group-count">{groupCounts.get(topGroup)} paquetes · prioridad</span>
                  </div>
                </div>
              )}
              <div className="dashboard-header">
                <span className="dashboard-title">Reflujo por grupo de letras</span>
                <span className="dashboard-total">{reinjections.length} total</span>
              </div>
              <div className="group-bars">
                {allGroups.map(g => {
                  const count = groupCounts.get(g)
                  const pct = (count / maxCount) * 100
                  const isTop = g === topGroup
                  const isBlanca = g === 'ETIQUETA BLANCA'
                  return (
                    <div
                      key={g}
                      className={`group-bar-row${isTop ? ' group-bar-row--top' : ''}${isBlanca ? ' group-bar-row--blanca' : ''}`}
                    >
                      <span className="group-bar-label">{g === 'ETIQUETA BLANCA' ? 'ET. BLANCA' : g}</span>
                      <div className="group-bar-track">
                        <div className="group-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="group-bar-count">{count}</span>
                    </div>
                  )
                })}
              </div>

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
                <div
                  key={i}
                  className={`history-row${r.route === 'ETIQUETA BLANCA' ? ' history-row--blanca' : ''}`}
                >
                  <span className="history-id">{r.id}</span>
                  <span className="history-meta">
                    {new Date(r.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {' · '}
                    <span className="reinject-route">{r.route}</span>
                    {r.rawRoute && r.route !== 'ETIQUETA BLANCA' && (
                      <span className="reinject-raw"> ({r.rawRoute})</span>
                    )}
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
