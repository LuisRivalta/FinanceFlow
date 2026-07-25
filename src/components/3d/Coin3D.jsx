"use client";

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import anime from 'animejs';

function CoinMesh() {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (meshRef.current) {
            // Replicate Float behavior
            meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.1;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
            
            if (!hovered) {
                meshRef.current.rotation.y += delta * 1.5;
            }
        }
    });

    const handlePointerOver = () => {
        setHovered(true);
        anime({
            targets: meshRef.current.scale,
            x: 1.2,
            y: 1.2,
            z: 1.2,
            duration: 400,
            easing: 'easeOutElastic(1, .5)'
        });
        anime({
            targets: meshRef.current.rotation,
            y: meshRef.current.rotation.y + Math.PI * 2,
            duration: 800,
            easing: 'easeOutExpo'
        });
    };

    const handlePointerOut = () => {
        setHovered(false);
        anime({
            targets: meshRef.current.scale,
            x: 1,
            y: 1,
            z: 1,
            duration: 300,
            easing: 'easeOutQuad'
        });
    };

    return (
        <group>
            <mesh 
                ref={meshRef} 
                onPointerOver={handlePointerOver} 
                onPointerOut={handlePointerOut}
                castShadow 
                receiveShadow
            >
                <cylinderGeometry args={[1, 1, 0.2, 32]} />
                <meshStandardMaterial 
                    color="#f59e0b" 
                    metalness={1} 
                    roughness={0.15} 
                />
            </mesh>
            
            {/* Inner Ring */}
            <mesh position={[0, 0, 0.11]}>
                <ringGeometry args={[0.7, 0.9, 32]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, -0.11]} rotation={[0, Math.PI, 0]}>
                <ringGeometry args={[0.7, 0.9, 32]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* B Logo Placeholder (Torus + Box) */}
            <mesh position={[0, 0, 0.1]}>
                <boxGeometry args={[0.2, 0.8, 0.05]} />
                <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0.2, 0.2, 0.1]}>
                <torusGeometry args={[0.2, 0.1, 16, 32, Math.PI]} />
                <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0.2, -0.2, 0.1]}>
                <torusGeometry args={[0.2, 0.1, 16, 32, Math.PI]} />
                <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.5} />
            </mesh>
        </group>
    );
}

export default function Coin3D({ style }) {
    return (
        <div style={{ width: '120px', height: '120px', cursor: 'pointer', ...style }}>
            <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[2, 5, 2]} intensity={1.5} />
                <spotLight position={[-2, 2, 5]} angle={0.3} penumbra={1} intensity={2} color="#f59e0b" />
                <CoinMesh />
                <directionalLight position={[0, -5, 0]} intensity={0.5} color="#fbbf24" />
            </Canvas>
        </div>
    );
}
