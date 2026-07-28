let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function playSuccess() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, ac.currentTime)
  gain.gain.setValueAtTime(0.25, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + 0.12)
}

export function playAlarm() {
  const ac = getCtx()

  // Loud repeating buzz: two rapid high-low pulses at full volume
  const pattern = [
    { freq: 987, t: 0.00, dur: 0.12 },
    { freq: 370, t: 0.13, dur: 0.12 },
    { freq: 987, t: 0.28, dur: 0.12 },
    { freq: 370, t: 0.41, dur: 0.12 },
    { freq: 987, t: 0.56, dur: 0.18 },
  ]

  pattern.forEach(({ freq, t, dur }) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'square'
    const start = ac.currentTime + t
    osc.frequency.setValueAtTime(freq, start)
    gain.gain.setValueAtTime(0.7, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
    osc.start(start)
    osc.stop(start + dur)
  })
}
