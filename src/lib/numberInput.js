// Helpers puros do NumberField. Ficam fora do componente para poderem ser
// testados sem DOM nem transform de JSX.

// Aceita apenas dígitos e um único separador decimal. Vírgula e ponto são
// equivalentes na entrada (pt-BR digita vírgula) e a saída normaliza pra vírgula.
export function sanitizeNumericText(raw, { decimals = 2 } = {}) {
    if (raw == null) return ''

    let text = String(raw).replace(/[^\d.,]/g, '')

    // Detecta separador de milhar (padrão pt-BR) antes da regra do primeiro
    // separador abaixo. Isso importa porque o formatCurrency deste app
    // (src/helpers.js) usa Intl.NumberFormat('pt-BR'), que produz strings
    // como "R$ 1.500,75" — se o usuário colar esse valor de volta no campo,
    // o "." precisa ser descartado como milhar, não tratado como decimal
    // (senão o valor vira 1/1000 do original).
    const dotCount = (text.match(/\./g) || []).length
    const hasComma = text.includes(',')

    if (dotCount > 0 && hasComma) {
        // Tem ponto e vírgula: a vírgula é o decimal, todo ponto é milhar.
        text = text.replace(/\./g, '')
    } else if (dotCount >= 2) {
        // Dois ou mais pontos sem vírgula só podem ser milhares ("1.234.567").
        text = text.replace(/\./g, '')
    } else if (dotCount === 1 && /^\d+\.\d{3}$/.test(text)) {
        // Um único ponto seguido de exatamente 3 dígitos e nada mais é milhar
        // ("1.000" -> 1000). Um ponto seguido de 1-2 dígitos (ex.: "1.5",
        // "14.15") continua decimal: é genuinamente ambíguo com vírgula
        // decimal, e essa regra nunca atrapalha os campos de 2 casas decimais
        // em que este componente é usado (o resultado de 2 casas nunca bate
        // com o padrão de 3 dígitos após o ponto).
        text = text.replace(/\./g, '')
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
