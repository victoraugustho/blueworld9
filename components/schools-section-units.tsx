"use client"

import * as React from "react"
import { MapPin, Search, ExternalLink, School } from "lucide-react"
import { AnimatedBackground } from "./animated-background"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type SchoolUnit = {
  id: string
  name: string
  address?: string
  city?: string
  state?: string // UF
}

const SCHOOLS: SchoolUnit[] = [
  {
    id: "ca-jacarepagua",
    name: "Colégio Adventista de Jacarepaguá",
    address: "Rua Luiz Beltrão, 1583 - Praça Seca, Rio de Janeiro - RJ, 21321-234.",
    city: "Rio de Janeiro",
    state: "RJ",
  },
  {
    id: "ca-itaguai",
    name: "Colégio Adventista de Itaguaí",
    address: "R. Manuel de Abreu, s/n - Vila Margarida, Itaguaí - RJ, 23815-430.",
    city: "Itaguaí",
    state: "RJ",
  },
  {
    id: "ca-padre-miguel",
    name: "Colégio Adventista de Padre Miguel",
    address: "Estr. do Realengo, 365 - Padre Miguel, Rio de Janeiro - RJ, 21715-331.",
    city: "Rio de Janeiro",
    state: "RJ",
  },
  {
    id: "ea-nova-iguacu",
    name: "Escola Adventista de Nova Iguaçu",
    address: "R. Pres. Sodré, 257 - Centro, Nova Iguaçu - RJ, 26215-180.",
    city: "Nova Iguaçu",
    state: "RJ",
  },
  {
    id: "ca-nova-iguacu",
    name: "Colégio Adventista de Nova Iguaçu",
    address: "R. Luiz de Camões, 615 - Alvarez, Nova Iguaçu - RJ, 26255-570.",
    city: "Nova Iguaçu",
    state: "RJ",
  },
  {
    id: "ea-jardim-metropole",
    name: "Escola Adventista de Jardim Metrópole",
    address: "Rua Visconde de Inhaúma, s/n - Jardim Metropole, São João de Meriti - RJ, 25575-300.",
    city: "São João de Meriti",
    state: "RJ",
  },
  {
    id: "ea-barra-tijuca",
    name: "Escola Adventista da Barra da Tijuca",
    address: "", // não veio completo na mensagem
    city: "Rio de Janeiro",
    state: "RJ",
  },
  {
    id: "ipae-petropolis",
    name: "Instituto Petropolitano Adventista de Ensino",
    address: "BR-040, KM 68 - Araras, Petrópolis - RJ, 25680-000.",
    city: "Petrópolis",
    state: "RJ",
  },
  {
    id: "ea-palmas-centro",
    name: "Escola Adventista de Palmas - Unidade Centro",
    address:
      "Quadra 210 Sul (Arse 24), Alameda 2, Área Institucional 09 - Plano Diretor Sul, Palmas - TO, 77020-586.",
    city: "Palmas",
    state: "TO",
  },
  {
    id: "ea-palmas-sul",
    name: "Escola Adventista de Palmas - Unidade Sul",
    address:
      "Conjunto 02 - Av. NS 01, Lote 07 - Quadra 701 Sul - Plano Diretor Sul, Palmas - TO, 77017-004.",
    city: "Palmas",
    state: "TO",
  },
  {
    id: "ca-anapolis",
    name: "Colégio Adventista de Anápolis",
    address: "Rua General Curado, S/N - Jundiaí, Anápolis - GO, 75110-280.",
    city: "Anápolis",
    state: "GO",
  },
  {
    id: "marshalls-alphaville",
    name: "Marshall's School (Unidade Alphaville)",
    address: "Alphaville, Santana de Parnaíba - SP.",
    city: "Santana de Parnaíba",
    state: "SP",
  },
  {
    id: "escola-aguia-anapolis",
    name: "Escola Águia - Unidade Anápolis",
    address: "Av. JK, Quadra 12, Lote 17 - Setor Sul Jamil Miguel, Anápolis - GO, 75124-710.",
    city: "Anápolis",
    state: "GO",
  },
  {
    id: "centro-educacional-aguia",
    name: "Centro Educacional Águia",
    address: "Av. Bernardo Sayão, Quadra 24, Lote 19 - Vila Jaiara, Anápolis - GO, 75064-010.",
    city: "Anápolis",
    state: "GO",
  },
]

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

function mapsUrl(unit: SchoolUnit) {
  const q =
    unit.address && unit.address.trim()
      ? `${unit.name} - ${unit.address}`
      : `${unit.name} ${unit.city ?? ""} ${unit.state ?? ""}`.trim()

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function SchoolsSectionUnits() {
  const [query, setQuery] = React.useState("")
  const [stateFilter, setStateFilter] = React.useState<string>("ALL")

  const states = React.useMemo(() => {
    const ufs = Array.from(new Set(SCHOOLS.map((s) => s.state).filter(Boolean))) as string[]
    ufs.sort()
    return ["ALL", ...ufs]
  }, [])

  const filtered = React.useMemo(() => {
    const q = normalize(query)
    return SCHOOLS.filter((s) => {
      const matchesUF = stateFilter === "ALL" ? true : s.state === stateFilter
      if (!q) return matchesUF
      const hay = normalize([s.name, s.address ?? "", s.city ?? "", s.state ?? ""].join(" "))
      return matchesUF && hay.includes(q)
    })
  }, [query, stateFilter])

  return (
    <section
      id="unidades"
      className="relative py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
    >
      <AnimatedBackground variant="about" />

      <div className="container mx-auto px-6 relative z-10 max-w-300">
        {/* HEADER */}
        <div data-aos="fade-down" className="text-center mb-16 space-y-4">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-cyan-600/20 to-cyan-500/20 border border-cyan-400/50 rounded-full backdrop-blur">
            <p className="text-sm font-semibold text-cyan-500 flex items-center gap-2 justify-center">
              <School className="w-4 h-4" />
              UNIDADES
            </p>
          </div>

          <h2 className="font-heading text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 bg-clip-text text-transparent">
            Escolas onde já estamos{" "}
            <span className="text-transparent text-white">presentes</span>
          </h2>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Encontre rapidamente a unidade por nome, cidade ou estado e abra o endereço no mapa.
          </p>
        </div>

        {/* CONTROLES */}
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Busca */}
          <div className="relative w-full lg:max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por escola, cidade, UF..."
              className="h-12 pl-11 bg-white/5 border-white/10 text-white placeholder:text-slate-400 backdrop-blur focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Filtro UF */}
          <div className="flex flex-wrap gap-2 justify-center lg:justify-end">
            {states.map((uf) => {
              const active = stateFilter === uf

              return (
                <Button
                  key={uf}
                  type="button"
                  variant="outline"
                  onClick={() => setStateFilter(uf)}
                  className={
                    active
                      ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 hover:border-cyan-400 backdrop-blur"
                      : "border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur"
                  }
                >
                  {uf === "ALL" ? "Todos" : uf}
                </Button>
              )
            })}
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((unit) => {
            const hasAddress = Boolean(unit.address && unit.address.trim())

            return (
              <div
                key={unit.id}
                data-aos="fade-up"
                className="rounded-2xl p-8 bg-white/5 border border-white/10 backdrop-blur shadow-lg hover:shadow-xl transition-shadow"
              >
                {/* Topo do card */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/25 to-blue-500/20 rounded-xl flex items-center justify-center border border-cyan-400/30">
                    <MapPin className="w-6 h-6 text-cyan-300" />
                  </div>

                  {/* Badge UF (no padrão do topo) */}
                  <div className="px-3 py-1 bg-gradient-to-r from-cyan-600/20 to-cyan-500/20 border border-cyan-400/40 rounded-full backdrop-blur">
                    <p className="text-xs font-semibold text-cyan-300">
                      {unit.state ?? "—"}
                    </p>
                  </div>
                </div>

                <h3 className="font-heading text-xl font-bold text-white mb-2">
                  {unit.name}
                </h3>

                <p className="text-slate-300 leading-relaxed mb-5">
                  <span className="text-slate-200 font-semibold">
                    {unit.city ?? "Cidade não informada"}
                  </span>
                  <br />
                  {hasAddress ? unit.address : "Endereço não informado (pendente)."}
                </p>

                <Button
                  asChild
                  variant="outline"
                  className="w-full border-white bg-white/10 hover:bg-cyan-500 hover:border-cyan-500 text-white backdrop-blur hover:scale-[1.02] transition-transform"
                >
                  <a href={mapsUrl(unit)} target="_blank" rel="noreferrer">
                    Ver no mapa
                    <ExternalLink className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </div>
            )
          })}
        </div>

        {/* EMPTY */}
        {filtered.length === 0 && (
          <div className="mt-12 rounded-2xl p-10 bg-white/5 border border-white/10 backdrop-blur text-center">
            <p className="text-slate-300">Nenhuma unidade encontrada com esse filtro.</p>
          </div>
        )}

        {/* Rodapé opcional com contador (mantendo padrão) */}
        <div className="mt-10 text-center text-slate-400">
          Mostrando <span className="text-slate-200 font-semibold">{filtered.length}</span> de{" "}
          <span className="text-slate-200 font-semibold">{SCHOOLS.length}</span> unidades
        </div>
      </div>
    </section>
  )
}
