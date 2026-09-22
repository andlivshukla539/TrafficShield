'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

export default function TokenBucketViz({ tokens = 10, capacity = 10 }) {
  const bucketRef = useRef();
  const tokenGroupRef = useRef();

  const tokenPositions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < capacity; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const radius = 0.6 + Math.random() * 0.2;
      const y = -1.2 + Math.floor(i / 5) * 0.5 + Math.random() * 0.1;
      pos.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    return pos;
  }, [capacity]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (bucketRef.current) {
      bucketRef.current.rotation.y = t * 0.2;
    }
    if (tokenGroupRef.current) {
      tokenGroupRef.current.children.forEach((child, i) => {
        if (i < tokens) {
          child.position.y = tokenPositions[i].y + Math.sin(t * 2 + i) * 0.05;
          child.visible = true;
          child.scale.setScalar(Math.min(1, child.scale.x + 0.1));
        } else {
          child.scale.setScalar(Math.max(0.001, child.scale.x - 0.1));
          if (child.scale.x <= 0.001) child.visible = false;
        }
      });
    }
  });

  return (
    <group position={[0, -0.5, 0]}>
      {/* The Bucket */}
      <mesh ref={bucketRef}>
        <cylinderGeometry args={[1.5, 1.2, 3, 32, 1, true]} />
        <meshPhysicalMaterial 
          color="#ffffff" 
          transparent 
          opacity={0.15} 
          roughness={0.1} 
          metalness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Bucket Bottom */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.1, 32]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.2} roughness={0.5} />
      </mesh>

      {/* Tokens */}
      <group ref={tokenGroupRef}>
        {tokenPositions.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.2, 16, 16]} />
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
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {tokens} / {capacity} Tokens
        </div>
      </Html>
    </group>
  );
}
