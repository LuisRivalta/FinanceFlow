"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function CustomSparkles({ count, scale, size, speed, opacity, color }) {
    const pointsRef = useRef();
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for(let i=0; i<count*3; i++) arr[i] = (Math.random() - 0.5) * scale;
        return arr;
    }, [count, scale]);
    
    useFrame((state, delta) => {
        if (pointsRef.current) pointsRef.current.rotation.y += delta * speed * 0.2;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={size} color={color} sizeAttenuation transparent opacity={opacity} blending={THREE.AdditiveBlending} />
        </points>
    );
}

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
            <CustomSparkles count={300} scale={12} size={0.05} speed={0.8} opacity={0.6} color={activeColor} />
            <CustomSparkles count={100} scale={6} size={0.08} speed={1.2} opacity={0.8} color="#ffffff" />
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
                <directionalLight position={[0, 10, 0]} intensity={1} />
            </Canvas>
        </div>
    );
}
