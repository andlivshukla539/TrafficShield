'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function ParticleField() {
  const ref = useRef();
  const count = 2000;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.1;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function FloatingRings() {
  const ring1 = useRef();
  const ring2 = useRef();
  const ring3 = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring1.current) {
      ring1.current.rotation.x = t * 0.1;
      ring1.current.rotation.y = t * 0.05;
    }
    if (ring2.current) {
      ring2.current.rotation.x = t * 0.08 + 1;
      ring2.current.rotation.z = t * 0.06;
    }
    if (ring3.current) {
      ring3.current.rotation.y = t * 0.12;
      ring3.current.rotation.z = t * 0.04 + 2;
    }
  });

  return (
    <>
      <mesh ref={ring1}>
        <torusGeometry args={[3.5, 0.01, 16, 100]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[4, 0.01, 16, 100]} />
        <meshBasicMaterial color="#a0a0a0" transparent opacity={0.1} />
      </mesh>
      <mesh ref={ring3}>
        <torusGeometry args={[4.5, 0.008, 16, 100]} />
        <meshBasicMaterial color="#666666" transparent opacity={0.08} />
      </mesh>
    </>
  );
}

function CoreGlow() {
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.1);
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
    </mesh>
  );
}

export default function ParticleSphere() {
  return (
    <div className="three-canvas">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <ParticleField />
        <FloatingRings />
        <CoreGlow />
      </Canvas>
    </div>
  );
}
