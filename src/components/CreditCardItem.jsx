"use client";

import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../helpers'
import { usagePercent } from '../lib/cardMetrics'

const MAX_TILT_DEG = 5

function Dots() {
    // Decorativas: não representam dado nenhum, só dão a silhueta de cartão.
    return (
        <div className="cc-dots" aria-hidden="true">
            {[0, 1].map(group => (
                <span key={group}>
                    {[0, 1, 2, 3].map(i => <span key={i} className="cc-dot" />)}
                </span>
            ))}
        </div>
    )
}

export default function CreditCardItem({ card, invoiceAmount, onEdit, onRemove, onPayInvoice }) {
    const faceRef = useRef(null)
    const [reducedMotion, setReducedMotion] = useState(false)

    // matchMedia não existe no servidor, então a leitura fica no effect.
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        setReducedMotion(mq.matches)

        const onChange = e => setReducedMotion(e.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    // O parallax escreve direto em custom properties, sem passar por estado: um
    // setState por mousemove re-renderizaria o card a cada pixel.
    const handleMove = e => {
        const el = faceRef.current
        if (!el || reducedMotion) return

        const rect = el.getBoundingClientRect()
        const relX = (e.clientX - rect.left) / rect.width
        const relY = (e.clientY - rect.top) / rect.height
        const nx = relX * 2 - 1
        const ny = relY * 2 - 1

        el.style.setProperty('--cc-ry', `${nx * MAX_TILT_DEG}deg`)
        el.style.setProperty('--cc-rx', `${-ny * MAX_TILT_DEG}deg`)
        // Camadas contra-deslocam em relação à inclinação: é o que faz o conteúdo
        // parecer estar sob um vidro, em vez de só a face girar.
        el.style.setProperty('--cc-px', String(-nx))
        el.style.setProperty('--cc-py', String(-ny))
        el.style.setProperty('--cc-mx', `${relX * 100}%`)
        el.style.setProperty('--cc-my', `${relY * 100}%`)
        el.dataset.tilting = 'true'
    }

    const handleLeave = () => {
        const el = faceRef.current
        if (!el) return

        // Volta ao repouso com a transição longa do CSS.
        el.dataset.tilting = 'false'
        el.style.setProperty('--cc-rx', '0deg')
        el.style.setProperty('--cc-ry', '0deg')
        el.style.setProperty('--cc-px', '0')
        el.style.setProperty('--cc-py', '0')
    }

    const invoice = Math.max(0, invoiceAmount)
    const pct = usagePercent(invoice, card.credit_limit)
    const hasInvoice = invoice > 0

    return (
        <div className="cc-item">
            <div
                ref={faceRef}
                className="cc-face"
                style={{ '--cc-color': card.color }}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
            >
                <div className="cc-row cc-depth-far">
                    <div className="cc-chip" aria-hidden="true" />
                    <span className="cc-brand">{card.brand}</span>

                    <div className="cc-actions">
                        <button className="cc-action" onClick={() => onEdit(card)} aria-label={`Editar ${card.name}`}>✏️</button>
                        <button className="cc-action" onClick={() => onRemove(card.id)} aria-label={`Excluir ${card.name}`}>🗑️</button>
                    </div>
                </div>

                <div className="cc-row cc-depth-mid" style={{ display: 'block' }}>
                    <div className="cc-label">Fatura atual</div>
                    <div className="cc-amount">{formatCurrency(invoice)}</div>
                </div>

                <div className="cc-row cc-depth-near" style={{ alignItems: 'flex-end' }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="cc-name">{card.name}</div>
                        <div className="cc-due">vence dia {card.due_day}</div>
                    </div>
                    <Dots />
                </div>
            </div>

            <div>
                <div className="cc-usage-track">
                    <div className="cc-usage-fill" style={{ width: `${pct}%`, background: card.color }} />
                </div>
                <div className="cc-usage-legend">
                    <span>{pct}% do limite</span>
                    <span>{formatCurrency(card.credit_limit)}</span>
                </div>
            </div>

            <button
                className="btn-primary"
                style={{
                    width: '100%',
                    padding: '10px 0',
                    fontSize: 13,
                    background: hasInvoice ? card.color : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    cursor: hasInvoice ? 'pointer' : 'default',
                }}
                onClick={() => onPayInvoice(card, invoice)}
                disabled={!hasInvoice}
            >
                {hasInvoice ? '🧾 Pagar fatura' : '✨ Fatura paga'}
            </button>
        </div>
    )
}
