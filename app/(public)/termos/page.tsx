import Link from "next/link"

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <h1 className="text-3xl font-semibold text-white">Termos de Uso</h1>
        <p className="text-sm text-slate-300">Versao 2026.04</p>

        <section className="space-y-3 text-sm leading-6 text-slate-200">
          <p>
            O uso da plataforma e restrito a usuarios autorizados. O usuario e responsavel pelo uso da conta e pela
            confidencialidade das credenciais de acesso.
          </p>
          <p>
            O sistema deve ser utilizado apenas para fins educacionais e administrativos vinculados ao portal. E vedado
            qualquer uso indevido de dados de terceiros.
          </p>
          <p>
            Ao utilizar a plataforma, o usuario concorda com as regras de seguranca, privacidade e boas praticas de
            operacao.
          </p>
        </section>

        <Link href="/cadastro" className="inline-flex text-cyan-300 hover:text-cyan-200 underline">
          Voltar ao cadastro
        </Link>
      </div>
    </main>
  )
}
