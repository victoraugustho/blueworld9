import Link from "next/link"

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <h1 className="text-3xl font-semibold text-white">Aviso de Privacidade</h1>
        <p className="text-sm text-slate-300">Versao 2026.04</p>

        <section className="space-y-3 text-sm leading-6 text-slate-200">
          <p>
            Este portal trata dados pessoais para cadastro, autenticacao, gestao academica e comunicacao com
            professores. Os dados sao usados apenas para finalidades legitimas do sistema.
          </p>
          <p>
            Voce pode solicitar acesso, correcao e outras medidas relacionadas aos seus dados pelos canais oficiais da
            plataforma.
          </p>
          <p>
            O sistema aplica medidas tecnicas e administrativas para protecao dos dados e registra eventos de auditoria
            para seguranca operacional.
          </p>
        </section>

        <Link href="/cadastro" className="inline-flex text-cyan-300 hover:text-cyan-200 underline">
          Voltar ao cadastro
        </Link>
      </div>
    </main>
  )
}
