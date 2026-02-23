import Link from "next/link"
import { Home, Mail, MapPin, Search } from "lucide-react"
import { AnimatedBackground } from "@/components/animated-background"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <AnimatedBackground variant="default" />

      <div className="relative z-10 container mx-auto px-6 py-28">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 backdrop-blur">
            <Search className="w-4 h-4" />
            Pagina nao encontrada
          </div>

          <h1 className="text-glow font-heading text-6xl sm:text-7xl md:text-8xl font-bold text-white">
            404
          </h1>

          <p className="text-lg md:text-xl text-slate-200">
            A pagina que voce tentou acessar nao existe ou foi movida. Use os
            links abaixo para voltar ao caminho certo.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8"
            >
              <Link href="/">
                <Home className="w-4 h-4" />
                Voltar ao inicio
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-cyan-500 hover:border-cyan-500 text-lg px-8 backdrop-blur"
            >
              <Link href="/#contato">
                <Mail className="w-4 h-4" />
                Falar com a equipe
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <Link
            href="/sobre"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur transition hover:border-cyan-400/60 hover:bg-white/10"
          >
            <h2 className="font-heading text-xl font-semibold text-white">Sobre a Blue World 9</h2>
            <p className="mt-2 text-sm text-slate-300">
              Conheca nossa historia, valores e metodologia.
            </p>
          </Link>

          <Link
            href="/para-escolas"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur transition hover:border-orange-400/60 hover:bg-white/10"
          >
            <h2 className="font-heading text-xl font-semibold text-white">Para escolas</h2>
            <p className="mt-2 text-sm text-slate-300">
              Descubra como levar tecnologia e inovacao para sua escola.
            </p>
          </Link>

          <Link
            href="/impacto"
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur transition hover:border-purple-400/60 hover:bg-white/10"
          >
            <h2 className="font-heading text-xl font-semibold text-white">Impacto</h2>
            <p className="mt-2 text-sm text-slate-300">
              Veja os resultados e historias de transformacao.
            </p>
          </Link>
        </div>

        <div className="mx-auto mt-12 flex flex-col items-center gap-2 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400" />
            America Latina
          </div>
          <span>Se precisar, estamos a um clique de distancia.</span>
        </div>
      </div>
    </main>
  )
}
