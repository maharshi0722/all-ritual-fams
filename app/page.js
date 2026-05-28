"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ─────────────────────────────────────────────
   IMAGE LIST
───────────────────────────────────────────── */
function buildImageList() {
  const community = [];
  for (let i = 3062; i <= 3270; i++) community.push(`/images/IMG_${i}.jpg`);
  const pngs = [];
  for (let i = 1; i <= 101; i++) pngs.push(`/images/${i}.png`);
  const mods = [
    "JEZ.JPG","JOSH.JPG","STEFAN.JPG","DUNKEN.JPG","ELIF.JPG",
    "BUNSDEV.JPG","CLARIE.JPG","ERIC.JPG","FLASH.JPG",
    "MAJORPROJECT.JPG","HINATA.JPG","KASH.JPG","MEISON.JPG","WHITESOCK.JPG",
  ].map((x) => `/images/${x}`);
  return [...mods, ...pngs, ...community];
}

/* ─────────────────────────────────────────────
   FIBONACCI SPHERE
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
   CIRCLE TEXTURE MASK  (renders a circle into a canvas → texture)
   So every PFP tile is a perfect circle on the sphere.
───────────────────────────────────────────── */
function makeCircleMaskCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  return c;
}

function makeCircleTexture(imgSrc, size = 256) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // clip to circle
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      // draw image centred / cover
      const s = Math.max(size / img.width, size / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      // white ring border
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 5;
      ctx.stroke();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve({ tex, ok: true });
    };
    img.onerror = () => resolve({ tex: null, ok: false });
    img.src = imgSrc;
  });
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const GLOBE_RADIUS  = 3.0;
const TILE_SIZE     = 0.52;
const MAX_TILES     = 260;
const AUTO_ROT_Y    = 0.00022;
const AUTO_ROT_X    = 0.00006;
const FALLBACK_HEX  = [0xb06ef5,0x8d3cf0,0x5b189a,0xd4b6ff,0x7c3aed,0xa855f7,0x6d28d9,0xc084fc];

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

  const [loaded,   setLoaded]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState(null); // { src }
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    /* SCENE */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8.2);
    cameraRef.current = camera;

    /* RENDERER */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    /* LIGHTS */
    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const sun = new THREE.DirectionalLight(0xfce4ff, 1.8);
    sun.position.set(6, 8, 6);
    scene.add(sun);
    const rim = new THREE.PointLight(0x9b59ff, 1.4, 25);
    rim.position.set(-7, -5, -7);
    scene.add(rim);

    /* OUTER GLOW SHELL */
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS + 0.55, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.07,
        side: THREE.BackSide,
      })
    ));

    /* THIN WIREFRAME LATITUDE LINES */
    const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.02, 36, 18);
    scene.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
      color: 0xd8b4fe,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    })));

    /* GLOBE GROUP */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    /* TILES */
    const allImages = buildImageList();
    const count     = Math.min(MAX_TILES, allImages.length);
    const positions = fibonacciSphere(count, GLOBE_RADIUS);
    const tiles     = [];
    let   done      = 0;

    const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

    positions.forEach((pos, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: FALLBACK_HEX[i % FALLBACK_HEX.length],
        roughness: 0.2,
        metalness: 0.05,
        transparent: true,
        opacity: 0,
        alphaTest: 0.01,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.lookAt(0, 0, 0);
      mesh.rotateY(Math.PI);
      // NO random tilt — keep faces clean and flat-on
      mesh.userData.imgSrc = allImages[i % allImages.length];
      globeGroup.add(mesh);
      tiles.push(mesh);

      makeCircleTexture(allImages[i % allImages.length], 256).then(({ tex, ok }) => {
        done++;
        setProgress(Math.floor((done / count) * 100));
        if (ok && tex) {
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          let op = 0;
          const fade = () => {
            op = Math.min(op + 0.04, 1.0);
            mat.opacity = op;
            if (op < 1.0) requestAnimationFrame(fade);
          };
          fade();
        } else {
          mat.opacity = 0.85;
        }
        if (done >= count) setLoaded(true);
      });
    });
    tilesRef.current = tiles;

    /* FLOATING RING PARTICLES */
    const pN   = 180;
    const pPos = new Float32Array(pN * 3);
    for (let i = 0; i < pN; i++) {
      const a = (i / pN) * Math.PI * 2;
      const r = GLOBE_RADIUS + 0.7 + Math.random() * 0.6;
      const tilt = (Math.random() - 0.5) * 0.7;
      pPos[i*3]   = Math.cos(a) * r;
      pPos[i*3+1] = Math.sin(a * 0.5) * 0.4 + tilt;
      pPos[i*3+2] = Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xe9d5ff, size: 0.028, transparent: true, opacity: 0.45,
    }));
    scene.add(particles);

    /* ANIMATION */
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      if (!isDragging.current) {
        velocity.current.x *= 0.90;
        velocity.current.y *= 0.90;
        globeGroup.rotation.y += velocity.current.x + AUTO_ROT_Y;
        globeGroup.rotation.x += velocity.current.y + AUTO_ROT_X;
      }

      particles.rotation.y -= 0.00025;

      /* raycasting hover */
      raycasterRef.current.setFromCamera(mouseNDC.current, camera);
      const hits = raycasterRef.current.intersectObjects(tiles);
      const hit  = hits.length ? hits[0].object : null;

      if (hoveredRef.current && hoveredRef.current !== hit) {
        hoveredRef.current.scale.setScalar(1.0);
        el.style.cursor = isDragging.current ? "grabbing" : "grab";
      }
      if (hit) {
        const s = THREE.MathUtils.lerp(hit.scale.x, 1.35, 0.14);
        hit.scale.setScalar(s);
        if (!isDragging.current) el.style.cursor = "pointer";
      }
      hoveredRef.current = hit;

      renderer.render(scene, camera);
    };
    animate();

    /* RESIZE */
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    /* MOUSE DRAG */
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
        el.style.cursor = "grabbing";
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
      if (hoveredRef.current) {
        setLightbox({ src: hoveredRef.current.userData.imgSrc });
      }
    };

    /* TOUCH */
    const onTouchStart = (e) => {
      prevMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current  = { x: 0, y: 0 };
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
    const onTouchEnd = (e) => {
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
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      {/* ══════════════ PAGE ══════════════ */}
      <main style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 0%,#e8d5ff 0%,#b06ef5 28%,#7c22d4 58%,#2e0a5e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        paddingTop: 24,
        paddingBottom: 32,
      }}>

        {/* subtle grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }} />

        {/* radial vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(10,2,30,0.55) 100%)",
        }} />

        {/* ── HEADER ── */}
        <header style={{
          position: "relative", zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 0, userSelect: "none",
          marginBottom: 0,
        }}>
          {/* logo */}
          <div style={{
            animation: "logoFloat 6s ease-in-out infinite",
            marginBottom: 16,
            filter: "drop-shadow(0 0 24px rgba(200,140,255,0.55))",
          }}>
            <Image
              src="/logo.png"
              width={80}
              height={80}
              priority
              alt="Ritual"
              style={{
                width: 80, height: 80,
                borderRadius: "50%",
                objectFit: "contain",
              }}
            />
          </div>

          <h1 style={{
            margin: 0,
            fontSize: "clamp(48px, 6.5vw, 90px)",
            fontWeight: 900,
            letterSpacing: "-3.5px",
            lineHeight: 0.9,
            color: "#fff",
            textShadow: "0 2px 0 rgba(0,0,0,0.15), 0 8px 32px rgba(80,0,160,0.45)",
          }}>
            Ritual Wall
          </h1>

          <p style={{
            margin: "14px 0 0",
            color: "rgba(255,255,255,0.45)",
            fontSize: 11,
            letterSpacing: "3px",
            textTransform: "uppercase",
            fontWeight: 700,
            fontFamily: "monospace",
          }}>
            {loaded
              ? "hover · click to view · drag to spin"
              : `loading community… ${progress}%`}
          </p>
        </header>

        {/* ── GLOBE ── */}
        <div ref={mountRef} style={{
          position: "relative", zIndex: 5,
          /* bigger on large screens */
          width:  "min(98vw, 860px)",
          height: "min(98vw, 860px)",
          cursor: "grab",
          /* pull it up slightly to overlap header nicely */
          marginTop: -16,
        }} />

        {/* ── LOADING BAR ── */}
        {!loaded && (
          <div style={{
            position: "absolute",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(260px, 70vw)",
            zIndex: 20,
          }}>
            <div style={{
              height: 3,
              borderRadius: 99,
              background: "rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #c084fc, #fff)",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        )}

        <style>{`
          @keyframes logoFloat {
            0%,100% { transform: translateY(0px) rotate(-1deg); }
            50%      { transform: translateY(-9px) rotate(1deg); }
          }
          @keyframes lbIn {
            from { opacity:0; transform: scale(0.82) translateY(16px); }
            to   { opacity:1; transform: scale(1)    translateY(0); }
          }
          @keyframes lbBgIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          canvas { display: block; }
          * { box-sizing: border-box; }
        `}</style>
      </main>

      {/* ══════════════ LIGHTBOX ══════════════ */}
      {lightbox && (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(8, 2, 22, 0.82)",
            backdropFilter: "blur(22px) saturate(1.4)",
            WebkitBackdropFilter: "blur(22px) saturate(1.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "lbBgIn 0.2s ease both",
            cursor: "zoom-out",
          }}
        >
          {/* card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "lbIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              padding: 8,
            }}
          >
            {/* image */}
            <div style={{
              width:  "min(78vw, 460px)",
              height: "min(78vw, 460px)",
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: `
                0 0 0 3px rgba(255,255,255,0.18),
                0 0 0 6px rgba(180,100,255,0.12),
                0 40px 100px rgba(0,0,0,0.7)
              `,
              background: "#1a0933",
              flexShrink: 0,
            }}>
              <img
                src={lightbox.src}
                alt=""
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "50%",
                }}
              />
            </div>

            {/* actions */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={closeLightbox}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 99,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  padding: "10px 32px",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  transition: "background 0.18s, border-color 0.18s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                }}
              >
                Close
              </button>
            </div>
          </div>

          <p style={{
            position: "absolute", bottom: 24,
            color: "rgba(255,255,255,0.22)",
            fontSize: 10, letterSpacing: "2.5px",
            textTransform: "uppercase",
            fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            tap outside to close
          </p>
        </div>
      )}
    </>
  );
}