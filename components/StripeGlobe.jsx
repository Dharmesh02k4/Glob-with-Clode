"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

/* ── Shaders (dot-matrix globe from map alpha) ──────── */
const dotVertexShader = `
uniform sampler2D u_map_tex;
uniform float u_dot_size;

#define PI 3.14159265359

varying float vOpacity;
varying vec2 vUv;

void main() {
  // IcosahedronGeometry vertices are already on a unit sphere
  vec3 p = normalize(position);

  // Convert sphere position → equirectangular UV
  float lon = atan(p.x, p.z);         // -PI .. PI
  float lat = asin(clamp(p.y, -1.0, 1.0)); // -PI/2 .. PI/2
  float u = lon / (2.0 * PI) + 0.5;   // 0 .. 1
  float v = lat / PI + 0.5;           // 0 .. 1
  vUv = vec2(u, v);

  // Sample map alpha at this UV — land has alpha > 0.5
  float visibility = step(0.5, texture2D(u_map_tex, vUv).a);
  gl_PointSize = visibility * u_dot_size;

  // Depth-based opacity (back dots dimmer)
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vOpacity = (1.0 / length(mvPosition.xyz) - 0.45);
  vOpacity = clamp(vOpacity, 0.15, 1.0);

  gl_Position = projectionMatrix * mvPosition;
}
`;

const dotFragmentShader = `
uniform vec3 u_dot_color;
varying float vOpacity;
varying vec2 vUv;

void main() {
  // Crisp circular dot shape (Stripe-style)
  float d = length(gl_PointCoord.xy - vec2(0.5));
  float dot = 1.0 - smoothstep(0.32, 0.38, d);
  if (dot < 0.4) discard;
  gl_FragColor = vec4(u_dot_color, dot * vOpacity * 1.2);
}
`;

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
    renderer.setClearColor(0x0a2540, 1)
    mount.appendChild(renderer.domElement)

    /* ── Scene / Camera ───────────────────────────────── */
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    camera.position.set(0, 0.15, 2.9)

    /* ── Globe Group ──────────────────────────────────── */
    const group = new THREE.Group()
    group.rotation.x = 0.2
    scene.add(group)

    const R = 1

    /* ── 1. Occluder Sphere (deep navy core) ──────── */
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(0.98, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a2540 })
    )
    group.add(occluder)

    /* ── 2. Dot-Matrix Globe (world_map1.png alpha) ── */
    let dotMaterial = null

    new THREE.TextureLoader().load('/world_map1.png', (mapTex) => {
      mapTex.minFilter = THREE.LinearFilter
      mapTex.magFilter = THREE.LinearFilter

      const globeGeometry = new THREE.IcosahedronGeometry(1, 120)

      dotMaterial = new THREE.ShaderMaterial({
        vertexShader: dotVertexShader,
        fragmentShader: dotFragmentShader,
        uniforms: {
          u_map_tex: { value: mapTex },
          u_dot_size: { value: Math.max(3.0, 0.0045 * Math.min(W, H)) },
          u_dot_color: { value: new THREE.Color(0x76b2e3) },
        },
        transparent: true,
        depthWrite: false,
      })

      const dots = new THREE.Points(globeGeometry, dotMaterial)
      dots.renderOrder = 1
      group.add(dots)
    })

    /* ── 3. Outer Atmosphere Glow ─────────────────── */
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x1a5a96, transparent: true, opacity: 0.06, side: THREE.BackSide })
    ))
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x0e3d6b, transparent: true, opacity: 0.05, side: THREE.BackSide })
    ))

    /* ── 4. City positions ───────────────────────────── */
    function toVec3(lat, lon, rad = 1.012) {
      const phi   = (90 - lat)  * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      return new THREE.Vector3(
        -rad * Math.sin(phi) * Math.cos(theta),
         rad * Math.cos(phi),
         rad * Math.sin(phi) * Math.sin(theta)
      )
    }

    const CITIES = {
      london: toVec3(51.5, -0.1), newyork: toVec3(40.7, -74.0),
      dubai: toVec3(25.2, 55.3), mumbai: toVec3(19.1, 72.9),
      tokyo: toVec3(35.7, 139.7), singapore: toVec3(1.3, 103.8),
      saopaulo: toVec3(-23.5, -46.6), sydney: toVec3(-33.9, 151.2),
      moscow: toVec3(55.7, 37.6), beijing: toVec3(39.9, 116.4),
      paris: toVec3(48.9, 2.3), toronto: toVec3(43.7, -79.4),
      nairobi: toVec3(-1.3, 36.8), lagos: toVec3(6.5, 3.4),
    }

    // Stripe-style vivid arc colors
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
      mg.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 12, 12),
        new THREE.MeshBasicMaterial({ color })
      ))
      const ring1 = new THREE.Mesh(
        new THREE.RingGeometry(0.019, 0.026, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      )
      ring1.lookAt(new THREE.Vector3(0, 0, 0)); mg.add(ring1)
      const ring2 = new THREE.Mesh(
        new THREE.RingGeometry(0.030, 0.035, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
      )
      ring2.lookAt(new THREE.Vector3(0, 0, 0)); mg.add(ring2)
      mg.position.copy(pos); mg.lookAt(new THREE.Vector3(0, 0, 0))
      group.add(mg)
      markerGroups.push({ mg, ring2, phase: Math.random() * Math.PI * 2 })
    })

    /* ── 6. Arc Definitions (Stripe-style multicolor) ── */
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

    const SEGS = 120, active = []
    let arcPtr = 0, spawnTimer = 0
    const SPAWN_RATE = 1.4

    function spawnArc() {
      const def = ARC_LIST[arcPtr % ARC_LIST.length]; arcPtr++
      const p1 = CITIES[def.from], p2 = CITIES[def.to]
      if (!p1 || !p2) return
      const mid = p1.clone().add(p2).multiplyScalar(0.5)
      mid.normalize().multiplyScalar(R + 0.28 + p1.distanceTo(p2) * 0.2)
      const curve = new THREE.QuadraticBezierCurve3(p1.clone(), mid, p2.clone())
      const pts = curve.getPoints(SEGS)
      const arcPos = new Float32Array((SEGS + 1) * 3)
      pts.forEach((p, i) => { arcPos[i*3]=p.x; arcPos[i*3+1]=p.y; arcPos[i*3+2]=p.z })
      const arcGeo = new THREE.BufferGeometry()
      arcGeo.setAttribute("position", new THREE.BufferAttribute(arcPos, 3))
      arcGeo.setDrawRange(0, 0)
      const line = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.88 }))
      group.add(line)
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 10, 10),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 1 })
      )
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 10, 10),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.18, depthWrite: false })
      )
      group.add(head); group.add(glow)
      active.push({ line, head, glow, curve, t: 0, phase: "draw", opacity: 0.88, pauseT: 0 })
    }

    /* ── 7. Mouse / Touch Interaction ────────────────── */
    let dragging = false, prevX = 0, prevY = 0, velX = 0, velY = 0
    const onDown = e => {
      dragging = true
      prevX = e.clientX ?? e.touches[0].clientX
      prevY = e.clientY ?? e.touches[0].clientY
      velX = velY = 0; mount.style.cursor = "grabbing"
    }
    const onMove = e => {
      if (!dragging) return
      const cx = e.clientX ?? e.touches[0].clientX, cy = e.clientY ?? e.touches[0].clientY
      group.rotation.y += (cx - prevX) * 0.004
      group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x + (cy - prevY) * 0.003))
      velX = (cy - prevY) * 0.003; velY = (cx - prevX) * 0.004; prevX = cx; prevY = cy
    }
    const onUp = () => { dragging = false; mount.style.cursor = "grab" }

    mount.addEventListener("mousedown", onDown)
    mount.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    mount.addEventListener("touchstart", e => { e.preventDefault(); onDown(e) }, { passive: false })
    mount.addEventListener("touchmove", e => { e.preventDefault(); onMove(e) }, { passive: false })
    mount.addEventListener("touchend", onUp)

    /* ── 8. Animation Loop ───────────────────────────── */
    let raf, prevT = performance.now()
    const tick = now => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - prevT) * 0.001, 0.05); prevT = now

      // Auto-rotate + inertia
      if (!dragging) {
        velY = velY * 0.94 + 0.001; velX *= 0.94
        group.rotation.y += velY
        group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x + velX))
      }

      // Pulse city rings
      markerGroups.forEach(({ ring2, phase }) => {
        ring2.material.opacity = 0.1 + 0.18 * Math.abs(Math.sin(now * 0.0025 + phase))
      })

      // Spawn arcs
      spawnTimer += dt
      if (spawnTimer >= SPAWN_RATE) { spawnArc(); spawnTimer = 0 }

      // Update arcs
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]
        if (a.phase === "draw") {
          a.t = Math.min(a.t + dt * 0.5, 1)
          a.line.geometry.setDrawRange(0, Math.ceil(a.t * SEGS) + 1)
          const hp = a.curve.getPoint(a.t); a.head.position.copy(hp); a.glow.position.copy(hp)
          if (a.t >= 1) { a.phase = "pause"; a.pauseT = 0 }
        } else if (a.phase === "pause") {
          a.pauseT += dt; if (a.pauseT > 1.0) a.phase = "fade"
        } else {
          a.opacity -= dt * 0.65
          if (a.opacity <= 0) {
            group.remove(a.line); group.remove(a.head); group.remove(a.glow)
            a.line.geometry.dispose(); a.line.material.dispose()
            a.head.geometry.dispose(); a.head.material.dispose()
            a.glow.geometry.dispose(); a.glow.material.dispose()
            active.splice(i, 1); continue
          }
          a.line.material.opacity = a.opacity
          a.head.material.opacity = a.opacity
          a.glow.material.opacity = a.opacity * 0.18
        }
      }
      renderer.render(scene, camera)
    }
    tick(performance.now())

    /* ── 9. Resize ───────────────────────────────────── */
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
      if (dotMaterial) dotMaterial.uniforms.u_dot_size.value = Math.max(3.0, 0.0045 * Math.min(w, h))
    }
    window.addEventListener("resize", onResize)

    /* ── Cleanup ─────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("resize", onResize)
      mount.removeEventListener("mousedown", onDown)
      mount.removeEventListener("mousemove", onMove)
      mount.removeEventListener("touchstart", onDown)
      mount.removeEventListener("touchmove", onMove)
      mount.removeEventListener("touchend", onUp)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{
      position: "relative", width: "100vw", height: "100vh", overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 45%, #0f3460 0%, #0a2540 40%, #061a30 100%)"
    }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "grab", userSelect: "none" }} />
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(6,20,38,0.6) 100%)"
      }} />
      <div style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
        color: "rgba(100,160,230,0.3)", fontSize: 12, letterSpacing: "0.18em",
        fontFamily: "monospace", pointerEvents: "none", userSelect: "none"
      }}>
        DRAG TO ROTATE
      </div>
    </div>
  )
}
