"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function GlassShape({ position, rotation, scale, geometryType, color }) {
    const meshRef = useRef();

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += delta * 0.1;
            meshRef.current.rotation.y += delta * 0.15;
        }
    });

    const geometry = useMemo(() => {
        if (geometryType === 'torus') return <torusGeometry args={[1, 0.3, 32, 64]} />;
        if (geometryType === 'icosahedron') return <icosahedronGeometry args={[1, 0]} />;
        return <octahedronGeometry args={[1, 0]} />;
    }, [geometryType]);

    return (
        <Float speed={2} rotationIntensity={1} floatIntensity={2} position={position}>
            <mesh ref={meshRef} rotation={rotation} scale={scale}>
                {geometry}
                <meshPhysicalMaterial
                    color={color}
                    transmission={0.9}
                    opacity={1}
                    metalness={0.1}
                    roughness={0.1}
                    ior={1.5}
                    thickness={0.5}
                    envMapIntensity={1}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                />
            </mesh>
        </Float>
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
                
                {/* Subtle particles across the screen */}
                <Sparkles count={50} scale={15} size={2} speed={0.4} opacity={0.2} color="#ffffff" />
                
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
