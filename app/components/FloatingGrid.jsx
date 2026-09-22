'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function GridParticles() {
  const ref = useRef();
  const count = 1500;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      // Gentle wave
      const posArray = ref.current.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const x = posArray[i * 3];
        const z = posArray[i * 3 + 2];
        posArray[i * 3 + 1] = Math.sin(x * 0.3 + state.clock.elapsedTime * 0.4) * 
                               Math.cos(z * 0.3 + state.clock.elapsedTime * 0.3) * 0.5;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.015}
        sizeAttenuation
        depthWrite={false}
        opacity={0.3}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function WaveGrid() {
  const ref = useRef();
  const gridSize = 30;
  const gridDivisions = 30;

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = -Math.PI / 3;
      ref.current.position.y = -3;
      // Subtle wave on the grid itself
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
    }
  });

  return (
    <group ref={ref}>
      <gridHelper
        args={[gridSize, gridDivisions, '#ffffff', '#1a1a1a']}
      />
    </group>
  );
}

export default function FloatingGrid() {
  return (
    <div className="three-canvas" style={{ opacity: 0.5 }}>
      <Canvas
        camera={{ position: [0, 5, 12], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <GridParticles />
        <WaveGrid />
      </Canvas>
    </div>
  );
}
