"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export default function StripeGlobe() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    const W = mount.clientWidth
    const H = mount.clientHeight

    /* ── Renderer ─────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    /* ── Scene / Camera ───────────────────────────────── */
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    camera.position.set(0, 0.1, 2.9)

    /* ── Globe Group ──────────────────────────────────── */
    const group = new THREE.Group()
    group.rotation.x = 0.18
    scene.add(group)

    const R = 1

    /* ── 1. Occluder Sphere (hides back-side dots) ─────── */
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(0.985, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x04091a })
    )
    group.add(occluder)

    /* ── 2. Dot Cloud (Fibonacci sphere) ──────────────── */
    const N = 13000
    const dotPos = new Float32Array(N * 3)
    const dotCol = new Float32Array(N * 3)
    const golden = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i
      dotPos[i * 3]     = Math.cos(theta) * r * R
      dotPos[i * 3 + 1] = y * R
      dotPos[i * 3 + 2] = Math.sin(theta) * r * R
      const t = 0.65 + Math.random() * 0.35
      dotCol[i * 3]     = 0.05 * t
      dotCol[i * 3 + 1] = (0.25 + Math.random() * 0.1) * t
      dotCol[i * 3 + 2] = (0.55 + Math.random() * 0.2) * t
    }

    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3))
    dotGeo.setAttribute("color",    new THREE.BufferAttribute(dotCol, 3))
    group.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      size: 0.0072,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
    })))

    /* ── 3. Outer Atmosphere ──────────────────────────── */
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x1145a8, transparent: true, opacity: 0.08, side: THREE.BackSide })
    ))
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.09, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a2d7a, transparent: true, opacity: 0.06, side: THREE.BackSide })
    ))

    /* ── 4. City positions ───────────────────────────── */
    function toVec3(lat, lon, rad = 1.022) {
      const phi   = (90 - lat)  * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      return new THREE.Vector3(
        -rad * Math.sin(phi) * Math.cos(theta),
         rad * Math.cos(phi),
         rad * Math.sin(phi) * Math.sin(theta)
      )
    }

    const CITIES = {
      london:    toVec3(51.5,   -0.1),
      newyork:   toVec3(40.7,  -74.0),
      dubai:     toVec3(25.2,   55.3),
      mumbai:    toVec3(19.1,   72.9),
      tokyo:     toVec3(35.7,  139.7),
      singapore: toVec3(1.3,   103.8),
      saopaulo:  toVec3(-23.5, -46.6),
      sydney:    toVec3(-33.9, 151.2),
      moscow:    toVec3(55.7,   37.6),
      beijing:   toVec3(39.9,  116.4),
      paris:     toVec3(48.9,    2.3),
      toronto:   toVec3(43.7,  -79.4),
      nairobi:   toVec3(-1.3,   36.8),
      lagos:     toVec3(6.5,    3.4),
    }

    const CITY_HEX = {
      london: 0xff6b9d, newyork: 0xc084fc, dubai: 0xfbbf24,
      mumbai: 0x38bdf8, tokyo: 0x34d399, singapore: 0xfb923c,
      saopaulo: 0xf87171, sydney: 0xa78bfa, moscow: 0x60a5fa,
      beijing: 0x4ade80, paris: 0xf472b6, toronto: 0x818cf8,
      nairobi: 0xfde68a, lagos: 0x6ee7b7,
    }

    /* ── 5. City Markers ─────────────────────────────── */
    const markerGroups = []
    Object.entries(CITIES).forEach(([name, pos]) => {
      const color = CITY_HEX[name]
      const mg = new THREE.Group()

      // Core dot
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 12),
        new THREE.MeshBasicMaterial({ color })
      )
      mg.add(core)

      // Inner ring
      const ring1 = new THREE.Mesh(
        new THREE.RingGeometry(0.021, 0.028, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
      )
      ring1.lookAt(new THREE.Vector3(0, 0, 0))
      mg.add(ring1)

      // Outer pulse ring (animated)
      const ring2 = new THREE.Mesh(
        new THREE.RingGeometry(0.032, 0.037, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
      )
      ring2.lookAt(new THREE.Vector3(0, 0, 0))
      mg.add(ring2)

      mg.position.copy(pos)
      mg.lookAt(new THREE.Vector3(0, 0, 0))
      group.add(mg)
      markerGroups.push({ mg, ring2, phase: Math.random() * Math.PI * 2 })
    })

    /* ── 6. Arc Definitions ──────────────────────────── */
    const ARC_LIST = [
      { from: "london",    to: "newyork",   color: 0xff6b9d },
      { from: "london",    to: "dubai",     color: 0xc084fc },
      { from: "dubai",     to: "mumbai",    color: 0xfbbf24 },
      { from: "mumbai",    to: "singapore", color: 0x38bdf8 },
      { from: "singapore", to: "tokyo",     color: 0x34d399 },
      { from: "moscow",    to: "beijing",   color: 0x60a5fa },
      { from: "newyork",   to: "saopaulo",  color: 0xf87171 },
      { from: "london",    to: "moscow",    color: 0xa78bfa },
      { from: "paris",     to: "dubai",     color: 0xfde68a },
      { from: "toronto",   to: "london",    color: 0x4ade80 },
      { from: "tokyo",     to: "sydney",    color: 0xf472b6 },
      { from: "beijing",   to: "singapore", color: 0x818cf8 },
      { from: "london",    to: "nairobi",   color: 0x6ee7b7 },
      { from: "newyork",   to: "paris",     color: 0xfb923c },
      { from: "dubai",     to: "beijing",   color: 0xfbbf24 },
      { from: "sydney",    to: "singapore", color: 0xc084fc },
    ]

    const SEGS = 120
    const active = []
    let arcPtr = 0
    let spawnTimer = 0
    const SPAWN_RATE = 1.4

    function spawnArc() {
      const def = ARC_LIST[arcPtr % ARC_LIST.length]
      arcPtr++
      const p1 = CITIES[def.from]
      const p2 = CITIES[def.to]
      if (!p1 || !p2) return

      const mid = p1.clone().add(p2).multiplyScalar(0.5)
      const dist = p1.distanceTo(p2)
      mid.normalize().multiplyScalar(R + 0.32 + dist * 0.22)

      const curve  = new THREE.QuadraticBezierCurve3(p1.clone(), mid, p2.clone())
      const pts    = curve.getPoints(SEGS)
      const arcPos = new Float32Array((SEGS + 1) * 3)
      pts.forEach((p, i) => { arcPos[i*3]=p.x; arcPos[i*3+1]=p.y; arcPos[i*3+2]=p.z })

      const arcGeo = new THREE.BufferGeometry()
      arcGeo.setAttribute("position", new THREE.BufferAttribute(arcPos, 3))
      arcGeo.setDrawRange(0, 0)
      const arcMat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.9 })
      const line   = new THREE.Line(arcGeo, arcMat)
      group.add(line)

      // Traveling head sphere
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.019, 8, 8),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 1 })
      )
      // Small inner glow sphere
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.034, 8, 8),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.2, depthWrite: false })
      )
      group.add(head)
      group.add(glow)

      active.push({ line, head, glow, curve, t: 0, phase: "draw", opacity: 0.9, pauseT: 0 })
    }

    /* ── 7. Mouse / Touch Interaction ────────────────── */
    let dragging  = false
    let prevX = 0, prevY = 0
    let velX  = 0, velY  = 0

    const onDown = e => {
      dragging = true
      prevX = e.clientX ?? e.touches[0].clientX
      prevY = e.clientY ?? e.touches[0].clientY
      velX = velY = 0
      mount.style.cursor = "grabbing"
    }
    const onMove = e => {
      if (!dragging) return
      const cx = e.clientX ?? e.touches[0].clientX
      const cy = e.clientY ?? e.touches[0].clientY
      const dx = cx - prevX
      const dy = cy - prevY
      group.rotation.y += dx * 0.0038
      group.rotation.x += dy * 0.0028
      group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x))
      velX = dy * 0.0028
      velY = dx * 0.0038
      prevX = cx; prevY = cy
    }
    const onUp = () => { dragging = false; mount.style.cursor = "grab" }

    mount.addEventListener("mousedown",  onDown)
    mount.addEventListener("mousemove",  onMove)
    window.addEventListener("mouseup",   onUp)
    mount.addEventListener("touchstart", e => { e.preventDefault(); onDown(e) },  { passive: false })
    mount.addEventListener("touchmove",  e => { e.preventDefault(); onMove(e) },  { passive: false })
    mount.addEventListener("touchend",   onUp)

    /* ── 8. Animation Loop ───────────────────────────── */
    let raf
    let prevT = performance.now()

    const tick = now => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - prevT) * 0.001, 0.05)
      prevT = now

      // Globe auto-rotate + inertia
      if (!dragging) {
        velY = velY * 0.93 + 0.0012
        velX *= 0.93
        group.rotation.y += velY
        group.rotation.x += velX
        group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x))
      }

      // Pulse city rings
      const pulse = Math.sin(now * 0.002)
      markerGroups.forEach(({ ring2, phase }) => {
        ring2.material.opacity = 0.12 + 0.18 * Math.abs(Math.sin(now * 0.0025 + phase))
      })

      // Spawn arcs
      spawnTimer += dt
      if (spawnTimer >= SPAWN_RATE) {
        spawnArc()
        spawnTimer = 0
      }

      // Update active arcs
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]

        if (a.phase === "draw") {
          a.t = Math.min(a.t + dt * 0.52, 1)
          a.line.geometry.setDrawRange(0, Math.ceil(a.t * SEGS) + 1)
          const hp = a.curve.getPoint(a.t)
          a.head.position.copy(hp)
          a.glow.position.copy(hp)
          if (a.t >= 1) { a.phase = "pause"; a.pauseT = 0 }

        } else if (a.phase === "pause") {
          a.pauseT += dt
          if (a.pauseT > 1.0) a.phase = "fade"

        } else { // fade
          a.opacity -= dt * 0.72
          if (a.opacity <= 0) {
            group.remove(a.line); group.remove(a.head); group.remove(a.glow)
            a.line.geometry.dispose(); a.line.material.dispose()
            a.head.geometry.dispose(); a.head.material.dispose()
            a.glow.geometry.dispose(); a.glow.material.dispose()
            active.splice(i, 1)
            continue
          }
          a.line.material.opacity = a.opacity
          a.head.material.opacity = a.opacity
          a.glow.material.opacity = a.opacity * 0.2
        }
      }

      renderer.render(scene, camera)
    }
    tick(performance.now())

    /* ── 9. Resize ───────────────────────────────────── */
    const onResize = () => {
      const W = mount.clientWidth, H = mount.clientHeight
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    }
    window.addEventListener("resize", onResize)

    /* ── Cleanup ─────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mouseup",   onUp)
      window.removeEventListener("resize",    onResize)
      mount.removeEventListener("mousedown",  onDown)
      mount.removeEventListener("mousemove",  onMove)
      mount.removeEventListener("touchstart", onDown)
      mount.removeEventListener("touchmove",  onMove)
      mount.removeEventListener("touchend",   onUp)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "radial-gradient(ellipse at 40% 50%, #071530 0%, #040c1c 55%, #020a16 100%)", overflow: "hidden" }}>
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", cursor: "grab", userSelect: "none" }}
      />
      {/* Vignette overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(2,9,20,0.55) 100%)"
      }} />
      {/* Subtle label */}
      <div style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
        color: "rgba(120,180,255,0.35)", fontSize: 12, letterSpacing: "0.18em",
        fontFamily: "monospace", pointerEvents: "none", userSelect: "none"
      }}>
        DRAG TO ROTATE
      </div>
    </div>
  )
}
