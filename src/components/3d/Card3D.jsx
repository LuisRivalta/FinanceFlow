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
                <CardControls />
                <CreditCard />

                {/* Fake shadow */}
                <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[5, 5]} />
                    <meshBasicMaterial color="#000000" transparent opacity={0.3} />
                </mesh>
            </Canvas>
        </div>
    );
}
