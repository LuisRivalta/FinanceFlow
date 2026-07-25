"use client";

import { useEffect, useRef, useState } from 'react'
import { sanitizeNumericText, parseNumericText, clampNumber, formatNumericValue } from '../lib/numberInput'

// Input numérico que aceita apenas digitação.
//
// type="text" + inputMode="decimal" em vez de type="number" porque type="number"
// traz as setinhas de incremento e altera o valor com a roda do mouse. Esconder
// as setinhas exigiria -webkit-appearance: none E -moz-appearance: textfield, e
// mesmo assim o scroll continuaria funcionando. inputMode mantém o teclado
// numérico no celular.
//
// O estado local guarda o TEXTO, não o número: guardando só Number, o usuário
// não consegue digitar "1," nem limpar o campo para redigitar, porque o React
// reescreve o valor no meio da digitação e o cursor pula.
export default function NumberField({
    value,
    onChange,
    min,
    max,
    decimals = 2,
    icon,
    suffix,
    ariaLabel,
}) {
    const [text, setText] = useState(() => formatNumericValue(value, { decimals }))
    const [editing, setEditing] = useState(false)

    // Distingue "campo focado" de "campo editado". Sem isso, só entrar e sair do
    // campo já emitia onChange, e quem consome não tem como saber que o valor não
    // partiu do usuário — na página de investimentos isso trocava o produto para
    // "Personalizado" e desligava a busca automática de taxa pra sempre.
    const dirty = useRef(false)

    // Reflete mudanças externas (ex: a taxa puxada do BCB) sem atropelar quem
    // está digitando naquele instante. Ao sair do campo sem ter editado, `editing`
    // volta a false e este effect ressincroniza o texto — é o que faz uma taxa que
    // chegou durante o foco aparecer, em vez de ser revertida.
    useEffect(() => {
        if (editing) return
        setText(formatNumericValue(value, { decimals }))
    }, [value, decimals, editing])

    const handleChange = e => {
        const next = sanitizeNumericText(e.target.value, { decimals })
        setText(next)

        const parsed = parseNumericText(next)
        // Campo vazio propaga 0 para o cálculo, mas o display continua vazio.
        const num = parsed === null ? 0 : parsed

        // Tecla que a máscara rejeitou (letra, 3ª casa decimal) não mudou nada:
        // propagar aqui seria reportar edição que não houve.
        if (num === value) return

        dirty.current = true
        onChange(num)
    }

    // Clamp só no blur. Clampando por tecla, um campo com min={1} impediria
    // apagar o conteúdo para digitar "10".
    const handleBlur = () => {
        setEditing(false)
        if (!dirty.current) return

        dirty.current = false
        const fallback = Number.isFinite(min) ? min : 0
        const parsed = parseNumericText(text)
        const settled = parsed === null ? fallback : clampNumber(parsed, { min, max })

        if (settled !== value) onChange(settled)
        setText(formatNumericValue(settled, { decimals }))
    }

    const handleFocus = () => {
        dirty.current = false
        setEditing(true)
    }

    return (
        <div className="tx-field" style={{ position: 'relative', margin: 0 }}>
            {icon && (
                <span
                    className="icon"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                    {icon}
                </span>
            )}
            <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={ariaLabel}
                style={{ paddingLeft: icon ? 40 : 14, paddingRight: suffix ? 36 : 14 }}
                value={text}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
            />
            {suffix && (
                <span
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                >
                    {suffix}
                </span>
            )}
        </div>
    )
}
