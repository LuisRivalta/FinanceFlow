"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function GlassShape({ position, rotation, scale, geometryType, color }) {
    const meshRef = useRef();
    const groupRef = useRef();
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Replicate Float behavior
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.2;
            groupRef.current.rotation.x = rotation[0] + Math.sin(state.clock.elapsedTime * 1) * 0.1;
            
            if (meshRef.current) {
                meshRef.current.rotation.x += delta * 0.1;
                meshRef.current.rotation.y += delta * 0.15;
            }
        }
    });

    const geometry = useMemo(() => {
        if (geometryType === 'torus') return <torusGeometry args={[1, 0.3, 32, 64]} />;
        if (geometryType === 'icosahedron') return <icosahedronGeometry args={[1, 0]} />;
        return <octahedronGeometry args={[1, 0]} />;
    }, [geometryType]);

    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            <mesh ref={meshRef} scale={scale}>
                {geometry}
                <meshPhysicalMaterial
                    color={color}
                    transmission={0.9}
                    opacity={1}
                    metalness={0.1}
                    roughness={0.1}
                    ior={1.5}
                    thickness={0.5}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                />
            </mesh>
        </group>
    );
}

export default function GlobalBackground() {
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -2, pointerEvents: 'none' }}>
            <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#6366f1" />
                
                {/* Background Shapes */}
                <GlassShape position={[-6, 3, -5]} rotation={[0, 0, 0]} scale={1.5} geometryType="icosahedron" color="#10b981" />
                <GlassShape position={[7, -2, -8]} rotation={[Math.PI / 4, 0, 0]} scale={2} geometryType="torus" color="#6366f1" />
                <GlassShape position={[-5, -4, -4]} rotation={[0, Math.PI / 2, 0]} scale={1.2} geometryType="octahedron" color="#f59e0b" />
                <GlassShape position={[6, 5, -6]} rotation={[0, 0, 0]} scale={1.8} geometryType="icosahedron" color="#eab308" />
                
                {/* Simple lighting replacing Environment */}
                <directionalLight position={[0, -10, 0]} intensity={0.5} color="#10b981" />
                <directionalLight position={[10, 0, -10]} intensity={0.5} color="#eab308" />
            </Canvas>
        </div>
    );
}
