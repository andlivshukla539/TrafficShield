'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import TokenBucketViz from './TokenBucketViz';
import LeakyBucketViz from './LeakyBucketViz';

export default function Playground3D({ activeAlgo, tokens, capacity }) {
  return (
    <Canvas 
      camera={{ position: [4, 2, 5], fov: 50 }} 
      gl={{ alpha: true }}
      style={{ background: 'transparent' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} maxDistance={10} minDistance={2} />
      
      {activeAlgo === 'token_bucket' ? (
        <TokenBucketViz tokens={tokens} capacity={capacity} />
      ) : (
        <LeakyBucketViz level={tokens} capacity={capacity} isLeaking={true} />
      )}
    </Canvas>
  );
}
