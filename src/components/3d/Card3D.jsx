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
    const cardRef = useRef();
    
    useFrame((state, delta) => {
        if (cardRef.current) {
            // Subtle floating effect
            cardRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
        }
    });

    return (
        <group ref={cardRef}>
            {/* Card Body */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[3.37, 2.12, 0.04]} />
                <meshStandardMaterial 
                    color={color || "#1e1b4b"} 
                    metalness={0.7} 
                    roughness={0.3} 
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

export default function Card3D({ card, onClose }) {
    if (!card) return null;

    return (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
        }}>
            <div style={{ position: 'absolute', top: 40, right: 40 }}>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>
                    Fechar ✖
                </button>
            </div>
            
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <h2 style={{ fontSize: 32, margin: 0, color: 'white' }}>{card.name}</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>Arraste para girar em 3D</p>
            </div>

            <div style={{ width: '600px', height: '400px', cursor: 'grab' }}>
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    {/* Rich Lighting setup to fake environment reflections */}
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[5, 5, 5]} intensity={2.5} />
                    <directionalLight position={[-5, -5, 5]} intensity={1.5} color="#ffffff" />
                    <pointLight position={[0, 0, 5]} intensity={2} color="#ffffff" />
                    <spotLight position={[5, -5, 5]} angle={0.2} penumbra={1} intensity={2} />

                    <CardControls />
                    <CreditCard color={card.color} />

                    {/* Fake shadow on the floor */}
                    <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[10, 10]} />
                        <meshBasicMaterial color="#000000" transparent opacity={0.5} />
                    </mesh>
                </Canvas>
            </div>
        </div>
    );
}
