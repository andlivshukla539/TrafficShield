'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

export default function LeakyBucketViz({ level = 5, capacity = 10, isLeaking = true }) {
  const waterRef = useRef();
  const dropsRef = useRef();
  
  const fillRatio = Math.min(1, Math.max(0, level / capacity));

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (waterRef.current) {
      const targetHeight = Math.max(0.01, fillRatio * 2.8);
      const currentHeight = waterRef.current.scale.y;
      waterRef.current.scale.y += (targetHeight - currentHeight) * 0.1;
      waterRef.current.position.y = -1.4 + (waterRef.current.scale.y / 2);
    }

    if (dropsRef.current && isLeaking && level > 0) {
      dropsRef.current.children.forEach((drop) => {
        drop.position.y -= 0.1;
        if (drop.position.y < -3) {
          drop.position.y = -1.5;
          drop.position.x = (Math.random() - 0.5) * 0.2;
        }
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* The Bucket */}
      <mesh>
        <cylinderGeometry args={[1.5, 1.2, 3, 32, 1, true]} />
        <meshPhysicalMaterial 
          color="#a0a0a0" 
          transparent 
          opacity={0.2} 
          roughness={0.1} 
          metalness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Bucket Bottom with Hole */}
      <mesh position={[0, -1.5, 0]}>
        <ringGeometry args={[0.2, 1.2, 32]} />
        <meshPhysicalMaterial color="#a0a0a0" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Water Cylinder (Dynamic Height) */}
      <mesh ref={waterRef} position={[0, -1.4, 0]} scale={[1, 0.1, 1]}>
        <cylinderGeometry args={[1.3, 1.1, 1, 32]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.4} transmission={0.9} />
      </mesh>

      {/* Leaking Drops */}
      <group ref={dropsRef}>
        {[...Array(5)].map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 0.2, -1.5 - i * 0.4, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      {/* Label */}
      <Html position={[0, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ 
          color: '#fff', 
          fontSize: '16px', 
          fontWeight: 'bold', 
          fontFamily: 'Inter, sans-serif',
          background: 'rgba(0,0,0,0.7)', 
          padding: '4px 12px', 
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          Queue: {level} / {capacity}
        </div>
      </Html>
    </group>
  );
}
