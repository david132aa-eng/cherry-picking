import { useState, useEffect, useRef } from 'react'
import FileLoader from './FileLoader'
import AlertModal from './AlertModal'
import { playSuccess, playAlarm } from '../services/audioService'
import {
  saveRecord, downloadCsv, todayDateStr,
  subscribeToTodayRoutes, syncRoutesToFirestore,
  saveScanToFirestore, subscribeToTodayScans,
} from '../services/storageService'
import { parseIds, parseIdsWithRoutes } from './FileLoader'

const ROUTES_KEY = () => 'cp_routes_' + todayDateStr()

function saveTodayRoutes(ids, name, routeMap) {
  localStorage.setItem(ROUTES_KEY(), JSON.stringify({
    ids: [...ids],
    name,
    routeMap: routeMap ? Object.fromEntries(routeMap) : {},
  }))
}

function loadTodayRoutes() {
  try {
    const raw = localStorage.getItem(ROUTES_KEY())
    if (raw) {
      const data = JSON.parse(raw)
      const routeMap = new Map(Object.entries(data.routeMap || {}))
      return { packages: new Set(data.ids), fileName: data.name, routeMap }
    }
  } catch {}
  return null
}

export default function Scanner({ onShowHistory, onShowReinject }) {
  const saved = loadTodayRoutes()
  const [routedPackages, setRoutedPackages] = useState(saved?.packages ?? null)
  const [routedFileName, setRoutedFileName] = useState(saved?.fileName ?? '')
  const [routeMap, setRouteMap] = useState(saved?.routeMap ?? null)
  const [syncLoading, setSyncLoading] = useState(!saved)
  const [inputVal, setInputVal] = useState('')
  const [alertPackage, setAlertPackage] = useState(null)
  const [scans, setScans] = useState([])
  const [sessionId] = useState('S-' + Date.now().toString(36).toUpperCase())
  const [showAddMore, setShowAddMore] = useState(false)
  const [addMoreText, setAddMoreText] = useState('')
  const inputRef = useRef()

  // Subscribe to today's scans — real-time across all devices
  useEffect(() => {
    return subscribeToTodayScans(records => setScans(records))
  }, [])

  // Subscribe to today's routes in Firestore for cross-device sync
  useEffect(() => {
    const timeout = setTimeout(() => setSyncLoading(false), 5000)
    const unsubscribe = subscribeToTodayRoutes((data) => {
      clearTimeout(timeout)
      setSyncLoading(false)
      if (data) {
        setRoutedPackages(data.ids)
        setRouteMap(data.routeMap)
        setRoutedFileName(data.name)
        saveTodayRoutes(data.ids, data.name, data.routeMap)
      }
    })
    return () => { unsubscribe(); clearTimeout(timeout) }
  }, [])

  useEffect(() => {
    if (routedPackages && !alertPackage) inputRef.current?.focus()
  }, [routedPackages, alertPackage])

  const handleLoad = (newRouteMap, name) => {
    const ids = new Set(newRouteMap.keys())
    saveTodayRoutes(ids, name, newRouteMap)
    setRoutedPackages(ids)
    setRouteMap(newRouteMap)
    setRoutedFileName(name)
    setScans([])
    syncRoutesToFirestore(newRouteMap, name).catch(() => {})
  }

  const handleClearRoutes = () => {
    localStorage.removeItem(ROUTES_KEY())
    setRoutedPackages(null)
    setRouteMap(null)
    setRoutedFileName('')
    setScans([])
    setShowAddMore(false)
  }

  const handleExportRoutes = () => {
    const content = [...(routedPackages || [])].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ruteados-${todayDateStr()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddMore = () => {
    const newRouteMap = parseIdsWithRoutes(addMoreText)
    if (!newRouteMap.size) return
    const currentMap = routeMap || new Map()
    const mergedMap = new Map([...currentMap, ...newRouteMap])
    const mergedIds = new Set(mergedMap.keys())
    const newName = `${routedFileName} +${newRouteMap.size}`
    saveTodayRoutes(mergedIds, newName, mergedMap)
    setRoutedPackages(mergedIds)
    setRouteMap(mergedMap)
    setRoutedFileName(newName)
    setAddMoreText('')
    setShowAddMore(false)
    syncRoutesToFirestore(mergedMap, newName).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const processScan = (id) => {
    if (!id) return
    const isRouted = routedPackages.has(id)
    const record = {
      ts: new Date().toISOString(),
      id,
      status: isRouted ? 'RUTEADO-ALERTA' : 'BUFFERED',
      session: sessionId,
    }
    saveRecord(record)
    saveScanToFirestore(record).catch(() => {})
    setScans(prev => [record, ...prev])
    if (isRouted) {
      playAlarm()
      setAlertPackage(id)
    } else {
      playSuccess()
    }
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

  const handleDismissAlert = () => {
    setAlertPackage(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleDownload = () => {
    downloadCsv(scans, `cherry-picking-${todayDateStr()}.csv`)
  }

  const buffered = scans.filter(s => s.status === 'BUFFERED').length
  const alerts = scans.filter(s => s.status === 'RUTEADO-ALERTA').length

  return (
    <div className="scanner-wrap">
      <div className="app-header">
        <div className="header-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--red-vivid)"/>
            <text x="12" y="17" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui">CP</text>
          </svg>
          <div>
            <div className="app-title">Cherry Picking</div>
            {routedPackages
              ? <div className="app-sub">{routedFileName} · {routedPackages.size} ruteados</div>
              : <div className="app-sub">Carga la base de ruteados para comenzar</div>
            }
          </div>
        </div>
        <div className="header-right">
          {scans.length > 0 && (
            <button className="btn-link" onClick={handleDownload}>CSV</button>
          )}
          <button className="btn-link" onClick={onShowReinject} title="Módulo Reinyección SAN1">
            Reinyección
          </button>
          <button className="btn-icon" onClick={onShowHistory} title="Ver historial">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          {routedPackages && (
            <>
              <button className="btn-icon" title="Descargar base" onClick={handleExportRoutes}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <button
                className={`btn-icon${showAddMore ? ' btn-icon--active' : ''}`}
                title="Agregar más IDs"
                onClick={() => { setShowAddMore(v => !v); setAddMoreText('') }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </button>
              <button className="btn-icon" title="Cambiar base" onClick={handleClearRoutes}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {syncLoading ? (
        <div className="scanner-main">
          <div className="scan-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="sync-spinner" />
            <p className="scan-hint" style={{ marginTop: '1rem' }}>Sincronizando con la nube…</p>
          </div>
        </div>
      ) : !routedPackages ? (
        <div className="scanner-main">
          <div className="scan-card">
            <p className="scan-label" style={{ marginBottom: '1rem', fontSize: '14px' }}>
              Carga la base de paquetes ruteados (ID, Grupo)
            </p>
            <FileLoader onLoad={handleLoad} />
          </div>
        </div>
      ) : (
        <div className="scanner-main">
          {showAddMore && (
            <div className="scan-card">
              <label className="scan-label">Agregar IDs a la base actual</label>
              <textarea
                className="paste-textarea"
                placeholder={'ID,Ruta o solo IDs:\nCE47120890002,AB\nCE47120890003\n...'}
                value={addMoreText}
                onChange={e => setAddMoreText(e.target.value)}
                rows={5}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  className="btn-primary"
                  disabled={parseIds(addMoreText).size === 0}
                  onClick={handleAddMore}
                  style={{ flex: 1 }}
                >
                  {parseIds(addMoreText).size > 0
                    ? `Agregar ${parseIds(addMoreText).size} IDs`
                    : 'Pega IDs arriba'}
                </button>
                <button className="btn-signout" onClick={() => { setShowAddMore(false); setAddMoreText('') }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="scan-card">
            <label className="scan-label">Escanea o escribe el ID del paquete</label>
            <form onSubmit={handleScan}>
              <input
                ref={inputRef}
                className={`scan-input${alertPackage ? ' scan-input--blocked' : ''}`}
                value={inputVal}
                onChange={handleChange}
                placeholder="ID del paquete..."
                disabled={!!alertPackage}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </form>
            <p className="scan-hint">
              Bipa el paquete · registra automáticamente · {routedPackages.size} ruteados cargados
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-num">{scans.length}</span>
              <span className="stat-lbl">Total bipeados</span>
            </div>
            <div className="stat-card">
              <span className="stat-num stat-green">{buffered}</span>
              <span className="stat-lbl">Buffered</span>
            </div>
            <div className="stat-card">
              <span className="stat-num stat-red">{alerts}</span>
              <span className="stat-lbl">Alertas</span>
            </div>
          </div>

          {scans.length > 0 && (
            <div className="history">
              <div className="history-header">Bipes de hoy — todos los dispositivos ({scans.length})</div>
              {scans.map((s, i) => (
                <div key={i} className={`history-row${s.status === 'RUTEADO-ALERTA' ? ' history-row--ruteado' : ''}`}>
                  <span className="history-id">{s.id}</span>
                  <span className="history-meta">
                    {new Date(s.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="session-id">Sesión: {sessionId}</div>
        </div>
      )}

      {alertPackage && (
        <AlertModal packageId={alertPackage} onDismiss={handleDismissAlert} />
      )}
    </div>
  )
}
