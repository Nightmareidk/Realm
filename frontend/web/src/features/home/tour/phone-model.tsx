"use client";

import { RoundedBox } from "@react-three/drei";
import { forwardRef, useMemo } from "react";
import * as THREE from "three";

/**
 * A phone, modelled in code: no brand's trade dress, just a rounded slab with a metal rim, a
 * matte back with a camera bump and Realm's mark, and a glass screen showing a real screen of the
 * app (a texture rendered from scripts/home-screens). Screen 390x844 CSS px → 0.72 x 1.558 units.
 */
export const PHONE = { w: 0.8, h: 1.64, d: 0.085, screenW: 0.72, screenH: 0.72 / (390 / 844) };

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 12);
  // ShapeGeometry's UVs are its positions; map them onto 0..1 so a texture fills the screen.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  return geo;
}

/** The back's mark, drawn once into a small texture: a ring with a dot caught inside. */
function useMarkTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.strokeStyle = "rgba(255,255,255,0.32)";
      g.lineWidth = 18;
      g.beginPath();
      g.arc(128, 128, 96, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.32)";
      g.beginPath();
      g.arc(156, 102, 40, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

export type PhoneProps = { screen: THREE.Texture | null } & Omit<
  React.ComponentProps<"group">,
  "children"
>;

export const PhoneModel = forwardRef<THREE.Group, PhoneProps>(function PhoneModel(
  { screen, ...props },
  ref,
) {
  const screenGeo = useMemo(() => roundedRect(PHONE.screenW, PHONE.screenH, 0.085), []);
  const glassGeo = useMemo(
    () => roundedRect(PHONE.screenW + 0.02, PHONE.screenH + 0.02, 0.095),
    [],
  );
  const mark = useMarkTexture();
  const { w, h, d } = PHONE;
  return (
    <group ref={ref} {...props}>
      {/* Rim: polished metal, just proud of the body */}
      <RoundedBox args={[w, h, d]} radius={0.11} smoothness={6} bevelSegments={4} creaseAngle={0.4}>
        <meshStandardMaterial
          color="#5a5a66"
          metalness={0.95}
          roughness={0.28}
          envMapIntensity={1.2}
        />
      </RoundedBox>
      {/* Front: black glass around the screen */}
      <mesh geometry={glassGeo} position={[0, 0, d / 2 + 0.0008]}>
        <meshStandardMaterial
          color="#050507"
          metalness={0.2}
          roughness={0.12}
          envMapIntensity={0.9}
        />
      </mesh>
      {/* The screen itself: unlit, so the UI shows its true colours */}
      <mesh geometry={screenGeo} position={[0, 0, d / 2 + 0.0016]}>
        <meshBasicMaterial
          map={screen ?? undefined}
          color={screen ? "#ffffff" : "#0b0b0e"}
          toneMapped={false}
        />
      </mesh>
      {/* A faint sheen on the glass that catches the studio lights as the phone turns */}
      <mesh geometry={glassGeo} position={[0, 0, d / 2 + 0.0024]}>
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.05}
          metalness={1}
          roughness={0.08}
          depthWrite={false}
        />
      </mesh>
      {/* Back: soft-touch matte with a camera bump and the mark */}
      <mesh geometry={glassGeo} position={[0, 0, -d / 2 - 0.0008]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial
          color="#1c1c23"
          metalness={0.35}
          roughness={0.55}
          envMapIntensity={0.7}
        />
      </mesh>
      <RoundedBox
        args={[0.3, 0.3, 0.03]}
        radius={0.07}
        smoothness={4}
        position={[-0.17, 0.58, -d / 2 - 0.012]}
      >
        <meshStandardMaterial color="#23232b" metalness={0.6} roughness={0.3} />
      </RoundedBox>
      {[
        [-0.23, 0.64],
        [-0.11, 0.52],
      ].map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, y, -d / 2 - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.046, 0.022, 28]} />
          <meshStandardMaterial color="#0a0a0d" metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
      <mesh position={[0, -0.05, -d / 2 - 0.0016]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial map={mark} transparent toneMapped={false} />
      </mesh>
    </group>
  );
});
