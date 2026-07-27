// Decisões de layout que dependem da largura da viewport e não podem ser
// resolvidas em CSS, porque são opções de configuração do Chart.js.

// Onde a legenda de um gráfico de rosca fica. À direita comprime o gráfico em
// tela estreita: num celular de 360px sobra cerca de 150px para a rosca.
//
// Recebe a largura como argumento em vez de ler `window` por dentro, para ser
// pura e testável — quem chama passa window.innerWidth de dentro do useEffect,
// onde `window` existe.
export function legendPosition(width, breakpoint = 768) {
    if (!Number.isFinite(width)) return 'right'
    return width <= breakpoint ? 'bottom' : 'right'
}

// Leitor seguro para SSR. Os call sites são useMemo, não useEffect, e useMemo
// EXECUTA no render do servidor — ler window.innerWidth direto ali quebra o
// prerender do Next com "window is not defined".
//
// No servidor devolve 'right', que é o layout de desktop: é o menos destrutivo,
// e o cliente recalcula na hidratação.
export function currentLegendPosition(breakpoint = 768) {
    if (typeof window === 'undefined') return 'right'
    return legendPosition(window.innerWidth, breakpoint)
}
