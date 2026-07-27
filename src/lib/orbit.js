// Matemática do sistema orbital do WealthParticles. Fica fora do componente para
// poder ser testada sem WebGL nem canvas.

// Velocidade angular em função do raio, na proporção da 3ª lei de Kepler
// (ω ∝ r^-3/2): a órbita interna corre mais que a externa.
//
// É o que faz o conjunto ler como um SISTEMA. Na versão anterior tudo girava no
// mesmo eixo a velocidades quase iguais (0.36 e 0.44 rad/s), então o resultado
// lia como um bloco único girando.
export function keplerSpeed(radius, base = 1) {
    if (!Number.isFinite(radius) || radius <= 0) return 0
    if (!Number.isFinite(base)) return 0
    return base * Math.pow(radius, -1.5)
}

// Ponto num disco fino, com o eixo FINO no terceiro componente (z).
//
// A orientação não é detalhe: a câmera fica em z=8 olhando para a origem, então o
// terceiro componente é o eixo de profundidade. Mantendo o disco no plano XY, a
// variação de profundidade fica limitada a ±thickness e todos os pontos aparecem
// do mesmo tamanho.
//
// O defeito da versão anterior era exatamente isso: distribuía num cubo de 12
// unidades, então havia ponto a 2 unidades da lente e ponto a 14 — o mesmo
// size=0.05 saía 7x maior num caso que no outro, o que lê como ruído.
//
// O sqrt() no raio distribui por ÁREA. Sem ele os pontos acumulam no centro,
// porque um anel de raio r tem circunferência proporcional a r.
//
// A soma de dois randoms aproxima uma gaussiana (distribuição triangular), o que
// deixa o disco denso no plano central e esparso nas bordas, como poeira real.
export function discPoint(rInner, rOuter, thickness, rng = Math.random) {
    const r = rInner + Math.sqrt(rng()) * (rOuter - rInner)
    const theta = rng() * Math.PI * 2
    const thin = (rng() + rng() - 1) * thickness

    return [Math.cos(theta) * r, Math.sin(theta) * r, thin]
}

export function discPositions(count, rInner, rOuter, thickness, rng = Math.random) {
    const arr = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
        const [x, y, z] = discPoint(rInner, rOuter, thickness, rng)
        arr[i * 3] = x
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = z
    }

    return arr
}

// Posição de um corpo sobre uma órbita circular de raio `radius`, no plano XY
// local. A inclinação fica no grupo que envolve o corpo, não aqui — assim o anel
// desenhado e o corpo que o percorre compartilham exatamente a mesma transformação
// e nunca saem de registro.
export function orbitPoint(radius, angle) {
    if (!Number.isFinite(radius) || !Number.isFinite(angle)) return [0, 0, 0]
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0]
}

// Fase inicial de cada corpo, espaçada de forma determinística. Usar Math.random
// aqui faria o sistema nascer diferente a cada render e impediria teste.
export function bodyPhase(index, total) {
    if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return 0
    return (index / total) * Math.PI * 2
}
