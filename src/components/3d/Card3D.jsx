"use client";

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function CardControls() {
    const { camera, gl } = useThree();
    useEffect(() => {
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / window.innerHeight) * 2 + 1;
            camera.position.x += (x * 0.5 - camera.position.x) * 0.05;
            camera.position.y += (y * 0.5 - camera.position.y) * 0.05;
            camera.lookAt(0, 0, 0);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [camera]);
    return null;
}

function CreditCard({ color }) {
    return (
        <group rotation={[0.1, -0.15, 0]}>
            {/* Card Body */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[3.37, 2.12, 0.04]} />
                <meshStandardMaterial 
                    color={color || "#1e1b4b"} 
                    metalness={0.8} 
                    roughness={0.2} 
                />
            </mesh>
            
            {/* Chip */}
            <mesh position={[-1.1, 0.2, 0.021]}>
                <boxGeometry args={[0.4, 0.3, 0.01]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Magnetic Stripe (Back) */}
            <mesh position={[0, 0.5, -0.021]}>
                <boxGeometry args={[3.37, 0.4, 0.01]} />
                <meshStandardMaterial color="#000000" metalness={0.2} roughness={0.8} />
            </mesh>
        </group>
    );
}

export default function Card3D({ card }) {
    if (!card) return null;

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.85, pointerEvents: 'none' }}>
            <Canvas camera={{ position: [0, 0, 2.4], fov: 45 }} frameloop="demand">
                <ambientLight intensity={1.5} />
                <directionalLight position={[5, 5, 5]} intensity={2.5} />
                <directionalLight position={[-5, -5, 5]} intensity={1.5} color="#ffffff" />
                <pointLight position={[0, 0, 5]} intensity={2} color="#ffffff" />
                
                <CreditCard color={card.color} />
            </Canvas>
        </div>
    );
}
