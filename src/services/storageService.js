import { db } from '../firebase'
import { doc, setDoc, updateDoc, getDoc, onSnapshot, arrayUnion } from 'firebase/firestore'

const PREFIX = 'cp_records_'

function localDateKey() {
  const d = new Date()
  return PREFIX + `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── localStorage (local cache / offline) ──────────────────────────────────────

export function saveRecord(record) {
  const key = localDateKey()
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

// ── Firestore sync ─────────────────────────────────────────────────────────────

export function subscribeToTodayRoutes(callback) {
  const ref = doc(db, 'daily', `routes-${todayDateStr()}`)
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ids: new Set(snap.data().ids), name: snap.data().name } : null)
  })
}

export async function syncRoutesToFirestore(ids, name) {
  await setDoc(doc(db, 'daily', `routes-${todayDateStr()}`), {
    ids: [...ids],
    name,
  })
}

// merge:true creates the doc if absent, or appends without overwriting
export async function saveScanToFirestore(record) {
  const ref = doc(db, 'daily', `scans-${todayDateStr()}`)
  await setDoc(ref, { records: arrayUnion(record) }, { merge: true })
}

export function subscribeToTodayScans(callback) {
  const ref = doc(db, 'daily', `scans-${todayDateStr()}`)
  return onSnapshot(ref, (snap) => {
    const records = snap.exists() ? (snap.data().records || []) : []
    callback([...records].sort((a, b) => b.ts.localeCompare(a.ts)))
  })
}

export async function getTodayScansFromFirestore() {
  const snap = await getDoc(doc(db, 'daily', `scans-${todayDateStr()}`))
  return snap.exists() ? (snap.data().records || []) : []
}

// ── CSV export ────────────────────────────────────────────────────────────────

function formatTs(iso) {
  const d = new Date(iso)
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  return `${date} ${time}`
}

export function downloadCsv(records, filename) {
  const header = 'Fecha,Hora,Shipment ID,Estado,Sesión'
  const rows = records.map(r => {
    const [date, time] = formatTs(r.ts).split(' ')
    return [date, time, r.id, r.status, r.session].map(v => `"${v}"`).join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
