"use client";
import { Pencil, Trash2 } from 'lucide-react'

// Os botões de editar/excluir de uma transação. Ficam num componente só porque
// a mesma dupla aparece no cartão da lista, no detalhe dos resumos e no extrato
// do crédito — e o usuário espera o mesmo gesto nos três lugares.
//
// O stopPropagation existe porque em alguns desses lugares a linha inteira já
// tem clique próprio (abrir detalhe), e excluir não pode disparar os dois.
export default function TxActions({ tx, onEdit, onDelete, size = 14 }) {
    if (!onEdit && !onDelete) return null

    const label = tx.desc || 'transação'

    return (
        <div className="tx-card-actions">
            {onEdit && (
                <button
                    type="button"
                    className="tx-act-btn"
                    onClick={e => { e.stopPropagation(); onEdit(tx) }}
                    title="Editar"
                    aria-label={`Editar ${label}`}
                >
                    <Pencil size={size} strokeWidth={1.8} />
                </button>
            )}
            {onDelete && (
                <button
                    type="button"
                    className="tx-act-btn tx-act-danger"
                    onClick={e => { e.stopPropagation(); onDelete(tx.id) }}
                    title="Excluir"
                    aria-label={`Excluir ${label}`}
                >
                    <Trash2 size={size} strokeWidth={1.8} />
                </button>
            )}
        </div>
    )
}
