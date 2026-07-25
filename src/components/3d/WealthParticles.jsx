"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';

function ParticleVortex({ activeColor }) {
    const groupRef = useRef();

    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.2;
            groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
            <Sparkles count={300} scale={12} size={4} speed={0.8} opacity={0.6} color={activeColor} noise={2} />
            <Sparkles count={100} scale={6} size={6} speed={1.2} opacity={0.8} color="#ffffff" noise={1} />
            {/* A subtle glowing core */}
            <mesh>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color={activeColor} transparent opacity={0.1} />
            </mesh>
        </group>
    );
}

export default function WealthParticles({ style, color = "#10b981" }) {
    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', ...style }}>
            <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <ParticleVortex activeColor={color} />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
