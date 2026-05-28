"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ─────────────────────────────────────────────
   IMAGE LIST  — mods first, then pngs, then community
───────────────────────────────────────────── */
function buildImageList() {
  const modNames = [
    "JEZ.JPG","JOSH.JPG","STEFAN.JPG","DUNKEN.JPG","ELIF.JPG",
    "BUNSDEV.JPG","CLARIE.JPG","ERIC.JPG","FLASH.JPG",
    "MAJORPROJECT.JPG","HINATA.JPG","KASH.JPG","MEISON.JPG","WHITESOCK.JPG","EL.JPG",
  ];
  const pngs = [];
  for (let i = 1; i <= 101; i++) pngs.push(`/images/${i}.png`);
  const community = [];
  for (let i = 3062; i <= 3270; i++) community.push(`/images/IMG_${i}.jpg`);

  // Filler pool — all non-mod images
  const filler = [...pngs, ...community]; // 310 images

  // Space each mod ~22 indices apart in the final array so their
  // Fibonacci sphere positions are spread across the full globe.
  // Consecutive Fibonacci indices sit very close together — by putting
  // ~22 fillers between each mod we guarantee >90° separation between
  // any two named members.
  const GAP    = Math.floor(filler.length / modNames.length); // ≈20
  const result = [...filler];
  modNames.forEach((name, i) => {
    result.splice(i * (GAP + 1), 0, `/images/${name}`);
  });
  return result;
}

/* ─────────────────────────────────────────────
   FIBONACCI SPHERE  – evenly spaced points
───────────────────────────────────────────── */
function fibonacciSphere(count, radius) {
  const pts = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push(new THREE.Vector3(
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius
    ));
  }
  return pts;
}

/* ─────────────────────────────────────────────
   SHARED CIRCLE ALPHA-MAP
   One 128×128 canvas, white circle = visible,
   black outside = transparent.  Reused by all tiles.
───────────────────────────────────────────── */
function makeCircleAlphaMap() {
  const sz  = 128;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = sz;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sz, sz);
  ctx.beginPath();
  ctx.arc(sz / 2, sz / 2, sz / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

/* ─────────────────────────────────────────────
   CONSTANTS  – tuned for 350 tiles
───────────────────────────────────────────── */
// For N tiles on sphere radius R, avg neighbour arc = 2R·√(π/N)
// N=350, R=3.9 → arc ≈ 0.735 → safe tile diameter = 0.58 (leaves ~21% gap)
const GLOBE_RADIUS  = 3.9;
const TILE_SIZE     = 0.58;
const MAX_TILES     = 350;
const AUTO_ROT_Y    = 0.00020;
const AUTO_ROT_X    = 0.00005;
const FALLBACK_HEX  = [
  0xb06ef5,0x8d3cf0,0x5b189a,0xd4b6ff,
  0x7c3aed,0xa855f7,0x6d28d9,0xc084fc,
];
// Batch how many textures start loading at once (avoids 350 simultaneous fetches)
const LOAD_BATCH    = 40;

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function RitualGlobe() {
  const mountRef      = useRef(null);
  const rendererRef   = useRef(null);
  const frameRef      = useRef(null);
  const globeGroupRef = useRef(null);
  const cameraRef     = useRef(null);
  const tilesRef      = useRef([]);
  const raycasterRef  = useRef(new THREE.Raycaster());
  const mouseNDC      = useRef(new THREE.Vector2(-9999, -9999));
  const hoveredRef    = useRef(null);
  const isDragging    = useRef(false);
  const prevMouse     = useRef({ x: 0, y: 0 });
  const velocity      = useRef({ x: 0, y: 0 });
  const pointerDown   = useRef(false);
  const clickBlock    = useRef(false);

  const [progress, setProgress] = useState(0);
  const [loaded,   setLoaded]   = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    /* ── SCENE ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, el.clientWidth / el.clientHeight, 0.1, 140);
    camera.position.set(0, 0, 10.2);
    cameraRef.current = camera;

    /* ── RENDERER ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    /* ── LIGHTS ── */
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xf5e8ff, 1.6);
    sun.position.set(7, 9, 6);
    scene.add(sun);
    const rim = new THREE.PointLight(0x9b59ff, 1.2, 28);
    rim.position.set(-8, -6, -8);
    scene.add(rim);

    /* ── DECORATIVE SHELLS ── */
    // outer soft glow
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS + 0.75, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.06, side: THREE.BackSide })
    ));
    // thin wireframe latitude grid
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS + 0.02, 40, 22),
      new THREE.MeshBasicMaterial({ color: 0xd8b4fe, wireframe: true, transparent: true, opacity: 0.03 })
    ));

    /* ── GLOBE GROUP ── */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    /* ── SHARED ALPHA MAP (circle mask) ── */
    const circleAlpha = makeCircleAlphaMap();

    /* ── TILES ── */
    const allImages = buildImageList();
    const count     = Math.min(MAX_TILES, allImages.length);
    const positions = fibonacciSphere(count, GLOBE_RADIUS);
    const tiles     = [];

    // One shared geometry for ALL tiles
    const sharedGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

    // Standard TextureLoader – reused for all loads
    const loader = new THREE.TextureLoader();
    let doneCount = 0;

    const onOneLoaded = () => {
      doneCount++;
      setProgress(Math.floor((doneCount / count) * 100));
      if (doneCount >= count) setLoaded(true);
    };

    // Build all meshes immediately with fallback colour
    positions.forEach((pos, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: FALLBACK_HEX[i % FALLBACK_HEX.length],
        roughness: 0.18,
        metalness: 0.04,
        transparent: true,
        alphaMap: circleAlpha,   // circle clipping via alpha
        opacity: 0,
        depthWrite: false,       // prevents z-fighting on overlapping transparencies
      });

      const mesh = new THREE.Mesh(sharedGeo, mat);
      mesh.position.copy(pos);
      mesh.lookAt(0, 0, 0);
      mesh.rotateY(Math.PI);     // face outward
      mesh.userData.imgSrc = allImages[i];
      globeGroup.add(mesh);
      tiles.push(mesh);
    });
    tilesRef.current = tiles;

    /* ── BATCHED TEXTURE LOADING ──
       Loads LOAD_BATCH images at a time to keep memory & network sane.
       Each loaded texture is applied immediately so tiles pop in progressively. */
    let batchStart = 0;
    const loadBatch = () => {
      const end = Math.min(batchStart + LOAD_BATCH, count);
      for (let i = batchStart; i < end; i++) {
        const mesh = tiles[i];
        const mat  = mesh.material;
        loader.load(
          allImages[i],
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter  = THREE.LinearMipmapLinearFilter;
            tex.magFilter  = THREE.LinearFilter;
            tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
            mat.map   = tex;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;
            // smooth fade-in
            let op = 0;
            const fade = () => {
              op = Math.min(op + 0.045, 1.0);
              mat.opacity = op;
              if (op < 1.0) requestAnimationFrame(fade);
            };
            fade();
            onOneLoaded();
          },
          undefined,
          () => {
            // error: show fallback colour circle
            mat.opacity = 0.78;
            onOneLoaded();
          }
        );
      }
      batchStart = end;
      if (batchStart < count) {
        // schedule next batch after a brief delay so browser isn't slammed
        setTimeout(loadBatch, 80);
      }
    };
    loadBatch();

    /* ── ORBIT RING PARTICLES ── */
    const pN   = 200;
    const pPos = new Float32Array(pN * 3);
    for (let i = 0; i < pN; i++) {
      const a = (i / pN) * Math.PI * 2;
      const r = GLOBE_RADIUS + 0.9 + Math.random() * 0.7;
      pPos[i*3]   = Math.cos(a) * r;
      pPos[i*3+1] = (Math.random() - 0.5) * 0.7;
      pPos[i*3+2] = Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xe9d5ff, size: 0.025, transparent: true, opacity: 0.42,
    }));
    scene.add(particles);

    /* ── ANIMATION LOOP ── */
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      if (!isDragging.current) {
        velocity.current.x *= 0.91;
        velocity.current.y *= 0.91;
        globeGroup.rotation.y += velocity.current.x + AUTO_ROT_Y;
        globeGroup.rotation.x += velocity.current.y + AUTO_ROT_X;
      }

      particles.rotation.y -= 0.00022;

      /* hover raycasting */
      raycasterRef.current.setFromCamera(mouseNDC.current, camera);
      const hits = raycasterRef.current.intersectObjects(tiles);
      const hit  = hits.length ? hits[0].object : null;

      if (hoveredRef.current && hoveredRef.current !== hit) {
        hoveredRef.current.scale.setScalar(1.0);
        if (!isDragging.current) el.style.cursor = "grab";
      }
      if (hit) {
        const s = THREE.MathUtils.lerp(hit.scale.x, 1.4, 0.13);
        hit.scale.setScalar(s);
        if (!isDragging.current) el.style.cursor = "pointer";
      }
      hoveredRef.current = hit;

      renderer.render(scene, camera);
    };
    animate();

    /* ── RESIZE ── */
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    /* ── MOUSE DRAG ── */
    const onMouseDown = (e) => {
      pointerDown.current = true;
      clickBlock.current  = false;
      isDragging.current  = false;
      prevMouse.current   = { x: e.clientX, y: e.clientY };
      velocity.current    = { x: 0, y: 0 };
    };
    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      mouseNDC.current.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouseNDC.current.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
      if (!pointerDown.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
        clickBlock.current = true;
        el.style.cursor    = "grabbing";
      }
      if (isDragging.current) {
        const vx = dx * 0.005, vy = dy * 0.004;
        velocity.current = { x: vx, y: vy };
        globeGroup.rotation.y += vx;
        globeGroup.rotation.x += vy;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => {
      pointerDown.current = false;
      isDragging.current  = false;
      el.style.cursor     = hoveredRef.current ? "pointer" : "grab";
    };
    const onClick = () => {
      if (clickBlock.current) { clickBlock.current = false; return; }
      if (hoveredRef.current) setLightbox({ src: hoveredRef.current.userData.imgSrc });
    };

    /* ── TOUCH ── */
    const onTouchStart = (e) => {
      prevMouse.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current   = { x: 0, y: 0 };
      isDragging.current = false;
      clickBlock.current = false;
    };
    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - prevMouse.current.x;
      const dy = e.touches[0].clientY - prevMouse.current.y;
      isDragging.current = true;
      clickBlock.current = true;
      const vx = dx * 0.005, vy = dy * 0.004;
      velocity.current = { x: vx, y: vy };
      globeGroup.rotation.y += vx;
      globeGroup.rotation.x += vy;
      prevMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => {
      isDragging.current = false;
      if (!clickBlock.current && hoveredRef.current) {
        setLightbox({ src: hoveredRef.current.userData.imgSrc });
      }
      clickBlock.current = false;
    };

    el.addEventListener("mousedown",  onMouseDown);
    el.addEventListener("click",      onClick);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize",    onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      el.removeEventListener("mousedown",  onMouseDown);
      el.removeEventListener("click",      onClick);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      circleAlpha.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      {/* ══════════════════════ PAGE ══════════════════════ */}
      <main style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 0%, #ecdcff 0%, #b06ef5 25%, #7c22d4 55%, #2e0a5e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        paddingTop: 28,
        paddingBottom: 28,
      }}>
        {/* grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }} />
        {/* vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(8,2,28,0.6) 100%)",
        }} />

        {/* ── HEADER ── */}
    <header
  style={{
    position: "relative",
    zIndex: 10,

    display: "flex",
    flexDirection: "column",
    alignItems: "center",

    userSelect: "none",

    marginBottom:
      typeof window !== "undefined" &&
      window.innerWidth < 768
        ? 10
        : -12,

    textAlign: "center",

    paddingInline: 16,
  }}
>
  {/* LOGO */}

  <div
    style={{
      animation:
        "logoFloat 6s ease-in-out infinite",

      marginBottom:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? 10
          : 14,

      filter:
        "drop-shadow(0 0 28px rgba(210,150,255,0.6)) drop-shadow(0 0 8px rgba(255,255,255,0.3))",
    }}
  >
    <Image
      src="/logo.png"
      width={
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? 58
          : 86
      }
      height={
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? 58
          : 86
      }
      priority
      alt="Ritual"
      style={{
        width:
          typeof window !==
            "undefined" &&
          window.innerWidth < 768
            ? 58
            : 86,

        height:
          typeof window !==
            "undefined" &&
          window.innerWidth < 768
            ? 58
            : 86,

        borderRadius: "50%",

        objectFit: "contain",
      }}
    />
  </div>

  {/* TITLE */}

  <h1
    style={{
      margin: 0,

      fontSize:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? "42px"
          : "clamp(50px, 6.5vw, 94px)",

      fontWeight: 900,

      letterSpacing:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? "-2px"
          : "-4px",

      lineHeight: 0.92,

      color: "#fff",

      textAlign: "center",

      textShadow:
        "0 2px 0 rgba(0,0,0,0.12), 0 10px 40px rgba(80,0,160,0.5)",
    }}
  >
    Ritual  Globe
  </h1>

  {/* SUBTEXT */}

  <p
    style={{
      margin:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? "10px 0 0"
          : "13px 0 0",

      color:
        "rgba(255,255,255,0.42)",

      fontSize:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? 9
          : 10,

      letterSpacing:
        typeof window !== "undefined" &&
        window.innerWidth < 768
          ? "2px"
          : "3.5px",

      textTransform: "uppercase",

      fontWeight: 700,

      fontFamily: "monospace",

      maxWidth: 320,

      lineHeight: 1.5,

      textAlign: "center",
    }}
  >
    Ritual is a lab for
    autonomous intelligence.
  </p>
</header>

        {/* ── GLOBE CANVAS ── */}
        <div
          ref={mountRef}
          style={{
            position: "relative", zIndex: 5,
            width:  "min(100vw, 900px)",
            height: "min(100vw, 900px)",
            cursor: "grab",
          }}
        />

        {/* ── PROGRESS BAR ── */}
        {!loaded && (
          <div style={{
            position: "absolute", bottom: 40,
            left: "50%", transform: "translateX(-50%)",
            width: "min(280px, 72vw)",
            zIndex: 20,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: "100%", height: 2, borderRadius: 99,
              background: "rgba(255,255,255,0.1)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg,#c084fc,#fff 80%)",
                borderRadius: 99,
                transition: "width 0.25s ease",
              }} />
            </div>
            <span style={{
              color: "rgba(255,255,255,0.28)",
              fontSize: 9, letterSpacing: "2px",
              fontFamily: "monospace", textTransform: "uppercase",
            }}>
              {progress} / 100
            </span>
          </div>
        )}

        <style>{`
          @keyframes logoFloat {
            0%,100%{ transform:translateY(0)   rotate(-1.2deg); }
            50%    { transform:translateY(-10px) rotate(1.2deg); }
          }
          @keyframes lbIn {
            from{ opacity:0; transform:scale(0.8) translateY(20px); }
            to  { opacity:1; transform:scale(1)   translateY(0); }
          }
          @keyframes lbBg {
            from{ opacity:0; }
            to  { opacity:1; }
          }
          canvas{ display:block; }
          *{ box-sizing:border-box; }
        `}</style>
      </main>

      {/* ══════════════════════ LIGHTBOX ══════════════════════ */}
      {lightbox && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed", inset: 0, zIndex: 3000,
            background: "rgba(6,1,20,0.85)",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
            animation: "lbBg 0.22s ease both",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "lbIn 0.32s cubic-bezier(0.22,1,0.36,1) both",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 22,
            }}
          >
            {/* ── circular image frame ── */}
            <div style={{
              width:  "min(72vw, 440px)",
              height: "min(72vw, 440px)",
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
              flexShrink: 0,
              /* layered ring glow */
              boxShadow: `
                0 0 0 3px rgba(255,255,255,0.22),
                0 0 0 8px rgba(180,90,255,0.18),
                0 0 0 14px rgba(120,40,220,0.10),
                0 48px 120px rgba(0,0,0,0.75)
              `,
            }}>
              <img
                src={lightbox.src}
                alt=""
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>

            {/* ── close btn ── */}
            <button
              onClick={closeLightbox}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 99,
                color: "rgba(255,255,255,0.75)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "3px",
                textTransform: "uppercase",
                fontFamily: "monospace",
                padding: "11px 36px",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background   = "rgba(255,255,255,0.16)";
                e.currentTarget.style.borderColor  = "rgba(255,255,255,0.35)";
                e.currentTarget.style.color        = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background   = "rgba(255,255,255,0.07)";
                e.currentTarget.style.borderColor  = "rgba(255,255,255,0.15)";
                e.currentTarget.style.color        = "rgba(255,255,255,0.75)";
              }}
            >
              Close
            </button>
          </div>

          <p style={{
            position: "absolute", bottom: 22,
            color: "rgba(255,255,255,0.18)",
            fontSize: 9, letterSpacing: "3px",
            textTransform: "uppercase", fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            tap outside to close
          </p>
        </div>
      )}
    </>
  );
}