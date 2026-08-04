import { db } from '../firebase'
import { doc, setDoc, getDoc, onSnapshot, arrayUnion } from 'firebase/firestore'

const PREFIX = 'cp_records_'

export function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── localStorage (local cache / offline) ──────────────────────────────────────

export function saveRecord(record) {
  const key = PREFIX + todayDateStr()
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push(record)
  localStorage.setItem(key, JSON.stringify(existing))
}

export function getRecords(date) {
  return JSON.parse(localStorage.getItem(PREFIX + date) || '[]')
}

export function getAllDates() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => k.slice(PREFIX.length))
    .sort((a, b) => b.localeCompare(a))
}

// ── Firestore — routes (shared by Cherry Picking + Reinyección) ───────────────

// routeMap: Map<id, route>
export async function syncRoutesToFirestore(routeMap, name) {
  await setDoc(doc(db, 'daily', `routes-${todayDateStr()}`), {
    routeMap: Object.fromEntries(routeMap),
    ids: [...routeMap.keys()], // backward compat
    name,
  })
}

export function subscribeToTodayRoutes(callback) {
  return onSnapshot(doc(db, 'daily', `routes-${todayDateStr()}`), (snap) => {
    if (!snap.exists()) { callback(null); return }
    const data = snap.data()
    let routeMap
    if (data.routeMap) {
      routeMap = new Map(Object.entries(data.routeMap))
    } else if (data.ids) {
      // backward compat: old format without route column
      routeMap = new Map(data.ids.map(id => [id, '']))
    }
    if (routeMap) callback({ ids: new Set(routeMap.keys()), routeMap, name: data.name })
  })
}

// ── Firestore — Cherry Picking scans ─────────────────────────────────────────

export async function saveScanToFirestore(record) {
  const ref = doc(db, 'daily', `scans-${todayDateStr()}`)
  await setDoc(ref, { records: arrayUnion(record) }, { merge: true })
}

export function subscribeToTodayScans(callback) {
  return onSnapshot(doc(db, 'daily', `scans-${todayDateStr()}`), (snap) => {
    const records = snap.exists() ? (snap.data().records || []) : []
    callback([...records].sort((a, b) => b.ts.localeCompare(a.ts)))
  })
}

export async function getTodayScansFromFirestore() {
  const snap = await getDoc(doc(db, 'daily', `scans-${todayDateStr()}`))
  return snap.exists() ? (snap.data().records || []) : []
}

// ── Firestore — Reinyección ───────────────────────────────────────────────────

export async function saveReinjectToFirestore(record) {
  const ref = doc(db, 'daily', `reinjections-${todayDateStr()}`)
  await setDoc(ref, { records: arrayUnion(record) }, { merge: true })
}

export function subscribeToReinjections(callback) {
  return onSnapshot(doc(db, 'daily', `reinjections-${todayDateStr()}`), (snap) => {
    const records = snap.exists() ? (snap.data().records || []) : []
    callback([...records].sort((a, b) => b.ts.localeCompare(a.ts)))
  })
}

// ── CSV export ────────────────────────────────────────────────────────────────

function formatTs(iso) {
  const d = new Date(iso)
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  return `${date} ${time}`
}

export function downloadCsv(records, filename, extraHeaders = []) {
  const baseHeaders = ['Fecha', 'Hora', 'Shipment ID', 'Estado', 'Sesión']
  const headers = [...baseHeaders, ...extraHeaders]
  const rows = records.map(r => {
    const [date, time] = formatTs(r.ts).split(' ')
    const base = [date, time, r.id, r.status ?? r.route ?? '', r.session]
    const extra = extraHeaders.map(h => r[h.toLowerCase()] ?? '')
    return [...base, ...extra].map(v => `"${v}"`).join(',')
  })
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
