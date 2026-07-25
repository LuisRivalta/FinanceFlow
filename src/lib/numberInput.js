// Helpers puros do NumberField. Ficam fora do componente para poderem ser
// testados sem DOM nem transform de JSX.

// Aceita apenas dígitos e um único separador decimal. Vírgula e ponto são
// equivalentes na entrada (pt-BR digita vírgula) e a saída normaliza pra vírgula.
export function sanitizeNumericText(raw, { decimals = 2 } = {}) {
    if (raw == null) return ''

    let text = String(raw).replace(/[^\d.,]/g, '')

    const sepCount = (text.match(/[.,]/g) || []).length
    if (sepCount > 1) {
        // Mais de um separador: o ÚLTIMO é o decimal, os anteriores são milhar.
        // Resolve pt-BR (1.500,75) e en-US (1,500.75) sem precisar saber a locale.
        const last = text.search(/[.,](?=[^.,]*$)/)
        const head = text.slice(0, last).replace(/[.,]/g, '')
        const tail = text.slice(last + 1)
        text = tail.length === 3 ? head + tail : `${head},${tail}`
    } else if (/^[1-9]\d*\.\d{3}$/.test(text)) {
        // Um ponto só seguido de exatamente 3 dígitos, com parte inteira sem zero
        // à esquerda: é milhar (1.000 = mil). '0.500' não entra, porque pt-BR nunca
        // agrupa com grupo zero — ali o ponto é decimal mesmo.
        //
        // Custo assumido: colar uma taxa de 3 casas ('10.500' = 10,5%) vira 10500 e
        // o clamp do campo Taxa corta em 100. É ambíguo de verdade e o erro fica
        // visível na hora. O caso que importa proteger é o do formatCurrency do app.
        text = text.replace('.', '')
    }

    // Mantém apenas o primeiro separador; os seguintes são descartados.
    const firstSep = text.search(/[.,]/)
    if (firstSep !== -1) {
        const head = text.slice(0, firstSep)
        const tail = text.slice(firstSep + 1).replace(/[.,]/g, '')
        text = `${head},${tail}`
    }

    if (decimals === 0) return text.split(',')[0]

    const [int, frac] = text.split(',')
    if (frac === undefined) return int
    return `${int},${frac.slice(0, decimals)}`
}

// Devolve null (não 0) para entrada incompleta, para o componente distinguir
// "campo vazio" de "o usuário digitou zero".
// Pressupõe que `text` já passou por sanitizeNumericText, ou seja, tem no
// máximo um separador. Por isso parseNumericText('1,500,75') devolver 1.5
// (só troca a primeira vírgula por ponto e ignora o resto) é consequência
// dessa premissa, não um bug — texto com mais de um separador não é uma
// entrada válida vinda do sanitizador.
export function parseNumericText(text) {
    if (text == null) return null
    const normalized = String(text).replace(',', '.')
    if (normalized === '' || normalized === '.') return null
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : null
}

// Valor não finito (NaN, null convertido etc.) passa direto, sem coerção —
// quem chama é responsável por tratar entrada vazia (ver parseNumericText)
// antes de chamar clampNumber.
export function clampNumber(value, { min, max } = {}) {
    if (!Number.isFinite(value)) return value
    if (Number.isFinite(min) && value < min) return min
    if (Number.isFinite(max) && value > max) return max
    return value
}

export function formatNumericValue(value, { decimals = 2 } = {}) {
    if (!Number.isFinite(value)) return ''

    let fixed = value.toFixed(decimals)
    // Só corta zeros à direita se existir parte decimal — senão 1000 viraria 1.
    if (fixed.includes('.')) {
        fixed = fixed.replace(/0+$/, '').replace(/\.$/, '')
    }
    return fixed.replace('.', ',')
}
