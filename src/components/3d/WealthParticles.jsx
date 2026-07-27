"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import anime from 'animejs';
import { keplerSpeed, discPositions, orbitPoint, bodyPhase } from '../../lib/orbit';

// Este efeito é visto quase inteiro ATRAVÉS dos painéis do simulador, que têm
// backdrop-filter: blur(20px) (globals.css, .glass-panel). Um blur desse tamanho
// destrói detalhe fino: os 300 pontos de size 0.05 da versão anterior viravam uma
// papa uniforme. O que sobrevive é forma larga, brilhante e de movimento lento —
// daí anéis visíveis e corpos com halo, em vez de mais partículas.
//
// Três inclinações diferentes, e não uma só: anéis concêntricos no mesmo plano
// leem como alvo de tiro, planos cruzados leem como sistema orbital.
const RINGS = [
    { radius: 2.6, tiltX: 1.30, tiltZ: 0.22, bodies: 2 },
    { radius: 3.9, tiltX: 1.12, tiltZ: -0.34, bodies: 1 },
    { radius: 5.3, tiltX: 1.44, tiltZ: 0.12, bodies: 2 },
];

const SPEED_BASE = 1.7;

const DUST_COUNT = 220;
const DUST_INNER = 1.8;
const DUST_OUTER = 6.4;
const DUST_THICKNESS = 0.35;

function OrbitRing({ ring, color, intro, frozen }) {
    const groupRef = useRef();
    const bodyRefs = useRef([]);
    const angle = useRef(0);
    const speed = useMemo(() => keplerSpeed(ring.radius, SPEED_BASE), [ring.radius]);

    useFrame((_, delta) => {
        const group = groupRef.current;
        if (!group) return;

        if (!frozen) angle.current += delta * speed;

        // O intro do anime.js entra como escala, não como opacidade de material:
        // mexer em opacidade por frame força recompilação de material no three.
        const p = intro.current.p;
        group.scale.setScalar(0.82 + p * 0.18);

        ring.bodies && bodyRefs.current.forEach((body, i) => {
            if (!body) return;
            const phase = bodyPhase(i, ring.bodies);
            const [x, y, z] = orbitPoint(ring.radius, angle.current + phase);
            body.position.set(x, y, z);
        });
    });

    return (
        <group ref={groupRef} rotation={[ring.tiltX, 0, ring.tiltZ]}>
            {/* O anel desenhado e os corpos compartilham este grupo, então nunca
                saem de registro por arredondamento de transformação. */}
            <mesh>
                <torusGeometry args={[ring.radius, 0.014, 6, 128]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.3}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </mesh>

            {Array.from({ length: ring.bodies }).map((_, i) => (
                <group key={i} ref={el => { bodyRefs.current[i] = el; }}>
                    <mesh>
                        <sphereGeometry args={[0.085, 12, 12]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    {/* Halo: é o que continua legível depois do blur de 20px. */}
                    <mesh>
                        <sphereGeometry args={[0.3, 12, 12]} />
                        <meshBasicMaterial
                            color={color}
                            transparent
                            opacity={0.22}
                            blending={THREE.AdditiveBlending}
                            depthWrite={false}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function DustDisc({ color, frozen }) {
    const pointsRef = useRef();

    // Semente fixa: com Math.random o disco nasceria diferente a cada montagem.
    const positions = useMemo(() => {
        let s = 20260725;
        const rng = () => {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
        return discPositions(DUST_COUNT, DUST_INNER, DUST_OUTER, DUST_THICKNESS, rng);
    }, []);

    useFrame((_, delta) => {
        if (!frozen && pointsRef.current) pointsRef.current.rotation.z += delta * 0.045;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                size={0.055}
                color={color}
                sizeAttenuation
                transparent
                opacity={0.5}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

function Core({ color, intro }) {
    const groupRef = useRef();

    useFrame(() => {
        if (groupRef.current) groupRef.current.scale.setScalar(0.5 + intro.current.p * 0.5);
    });

    // Duas esferas concêntricas de opacidade baixa em additive: um brilho amplo e
    // macio, que é a única coisa que atravessa o blur sem virar mancha chapada.
    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[0.55, 20, 20]} />
                <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[1.3, 20, 20]} />
                <meshBasicMaterial color={color} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </group>
    );
}

function OrbitSystem({ color, frozen, intro }) {
    return (
        <group rotation={[0, 0, 0]}>
            <Core color={color} intro={intro} />
            <DustDisc color={color} frozen={frozen} />
            {RINGS.map((ring, i) => (
                <OrbitRing key={i} ring={ring} color={color} intro={intro} frozen={frozen} />
            ))}
        </group>
    );
}

export default function WealthParticles({ style, color = '#10b981' }) {
    const wrapRef = useRef(null);
    const intro = useRef({ p: 0 });
    const [visible, setVisible] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const onChange = e => setReducedMotion(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    // Só renderiza enquanto a seção está na tela. É um fundo decorativo numa página
    // que também roda Chart.js — não faz sentido queimar frame fora de vista.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        const io = new IntersectionObserver(
            entries => setVisible(entries[0].isIntersecting),
            { rootMargin: '120px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // anime.js entra aqui e só aqui: uma entrada única com easeOutExpo, que combina
    // com o .fade-up delay-2 da seção. O movimento contínuo fica no useFrame, que é
    // a ferramenta certa para isso — anime.js num loop infinito brigaria com o
    // relógio do three.
    useEffect(() => {
        if (reducedMotion) {
            intro.current.p = 1;
            return;
        }
        if (!visible) return;

        const anim = anime({
            targets: intro.current,
            p: 1,
            duration: 1500,
            delay: 250,
            easing: 'easeOutExpo',
        });
        return () => anim.pause();
    }, [visible, reducedMotion]);

    return (
        <div
            ref={wrapRef}
            aria-hidden="true"
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', ...style }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 50 }}
                frameloop={visible ? 'always' : 'never'}
                dpr={[1, 1.5]}
                gl={{ antialias: false, powerPreference: 'low-power' }}
            >
                {/* Sem luzes: pointsMaterial e meshBasicMaterial não são iluminados,
                    então o ambientLight e o directionalLight da versão anterior
                    custavam parse e entregavam exatamente nada. */}
                <OrbitSystem color={color} frozen={reducedMotion} intro={intro} />
            </Canvas>
        </div>
    );
}
