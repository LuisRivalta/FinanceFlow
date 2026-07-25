// Helpers puros do NumberField. Ficam fora do componente para poderem ser
// testados sem DOM nem transform de JSX.

// Aceita apenas dígitos e um único separador decimal. Vírgula e ponto são
// equivalentes na entrada (pt-BR digita vírgula) e a saída normaliza pra vírgula.
export function sanitizeNumericText(raw, { decimals = 2 } = {}) {
    if (raw == null) return ''

    let text = String(raw).replace(/[^\d.,]/g, '')

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
export function parseNumericText(text) {
    if (text == null) return null
    const normalized = String(text).replace(',', '.')
    if (normalized === '' || normalized === '.') return null
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : null
}

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
