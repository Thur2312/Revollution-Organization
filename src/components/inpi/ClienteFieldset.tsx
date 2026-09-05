"use client"
import { Field } from '../ui/Field'
import { Select } from '../ui/Select'
import type { Cliente } from '../../../supabase/types'

export const CLIENTE_NOVO = '__novo__'
export const CLIENTE_NENHUM = ''

export interface NovoClienteState {
  nome: string
  email: string
  documento: string
  telefone: string
  observacoes: string
}

export function novoClienteVazio(): NovoClienteState {
  return { nome: '', email: '', documento: '', telefone: '', observacoes: '' }
}

// Seletor de cliente reutilizado onde quer que um processo precise
// vincular um: ao cadastrar (aba Processos) e ao vincular/trocar depois
// (detalhe do processo). "+ Cadastrar novo cliente" revela o cadastro
// completo inline em vez de mandar pra uma tela separada.
export function ClienteFieldset({
  clientes,
  selectedId,
  onSelectedIdChange,
  novo,
  onNovoChange,
}: {
  clientes: Cliente[]
  selectedId: string
  onSelectedIdChange: (id: string) => void
  novo: NovoClienteState
  onNovoChange: (novo: NovoClienteState) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Select label="Cliente" value={selectedId} onChange={(e) => onSelectedIdChange(e.target.value)}>
        <option value={CLIENTE_NENHUM}>Sem cliente vinculado</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome || c.email || 'Cliente sem nome'}
          </option>
        ))}
        <option value={CLIENTE_NOVO}>+ Cadastrar novo cliente</option>
      </Select>

      {selectedId === CLIENTE_NOVO && (
        <div className="grid gap-4 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
          <Field
            label="Nome"
            value={novo.nome}
            onChange={(e) => onNovoChange({ ...novo, nome: e.target.value })}
            placeholder="Ex.: Maria Souza"
          />
          <Field
            label="E-mail"
            type="email"
            value={novo.email}
            onChange={(e) => onNovoChange({ ...novo, email: e.target.value })}
            placeholder="cliente@exemplo.com"
          />
          <Field
            label="CPF/CNPJ"
            value={novo.documento}
            onChange={(e) => onNovoChange({ ...novo, documento: e.target.value })}
            placeholder="000.000.000-00"
          />
          <Field
            label="Telefone/WhatsApp"
            value={novo.telefone}
            onChange={(e) => onNovoChange({ ...novo, telefone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Observações</label>
            <textarea
              value={novo.observacoes}
              onChange={(e) => onNovoChange({ ...novo, observacoes: e.target.value })}
              rows={2}
              placeholder="Anotações sobre o cliente…"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  )
}
