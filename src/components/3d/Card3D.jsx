"use client";

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PresentationControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

function CreditCard() {
    const cardRef = useRef();
    
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        cardRef.current.position.y = Math.sin(t * 2) * 0.1;
        cardRef.current.rotation.x = Math.sin(t * 1) * 0.05;
        cardRef.current.rotation.y = Math.cos(t * 1) * 0.05;
    });

    return (
        <group ref={cardRef}>
            {/* Card Body */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[3.37, 2.12, 0.05]} />
                <meshPhysicalMaterial 
                    color="#1e1b4b" 
                    metalness={0.8} 
                    roughness={0.2} 
                    clearcoat={1} 
                    clearcoatRoughness={0.1}
                />
            </mesh>
            
            {/* Chip */}
            <mesh position={[-1.1, 0.2, 0.026]}>
                <boxGeometry args={[0.4, 0.3, 0.01]} />
                <meshStandardMaterial color="#fbbf24" metalness={1} roughness={0.2} />
            </mesh>

            {/* Logo placeholder */}
            <mesh position={[1.1, -0.6, 0.026]}>
                <boxGeometry args={[0.5, 0.15, 0.01]} />
                <meshStandardMaterial color="#818cf8" metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[1.1, -0.4, 0.026]}>
                <boxGeometry args={[0.5, 0.15, 0.01]} />
                <meshStandardMaterial color="#34d399" metalness={0.5} roughness={0.2} />
            </mesh>

            {/* Magnetic Stripe (Back) */}
            <mesh position={[0, 0.5, -0.026]}>
                <boxGeometry args={[3.37, 0.4, 0.01]} />
                <meshStandardMaterial color="#000000" metalness={0.1} roughness={0.8} />
            </mesh>
        </group>
    );
}

export default function Card3D({ style }) {
    return (
        <div style={{ width: '100%', height: '300px', cursor: 'grab', ...style }}>
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <spotLight position={[-5, 5, 5]} angle={0.15} penumbra={1} intensity={2} color="#6366f1" />
                
                <PresentationControls 
                    global 
                    rotation={[0, 0, 0]} 
                    polar={[-Math.PI / 4, Math.PI / 4]} 
                    azimuth={[-Math.PI / 4, Math.PI / 4]}
                    config={{ mass: 2, tension: 400 }}
                    snap={{ mass: 4, tension: 400 }}
                >
                    <CreditCard />
                </PresentationControls>

                <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2} far={4} color="#000000" />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
