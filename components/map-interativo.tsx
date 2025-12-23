"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"

type CountryKey = "brasil" | "uruguai" | "paraguai" | null

const countryData = {
  brasil: {
    name: "Brasil",
    description:
      "O Brasil é o maior país da América do Sul, com forte atuação em educação, tecnologia e inovação.",
    states: [
      "São Paulo",
      "Rio de Janeiro",
      "Minas Gerais",
      "Goiás",
      "Paraná",
      "Bahia",
    ],
  },
  uruguai: {
    name: "Uruguai",
    description:
      "O Uruguai possui um sistema educacional sólido e grande foco em tecnologia e inclusão digital.",
  },
  paraguai: {
    name: "Paraguai",
    description:
      "O Paraguai vem crescendo em iniciativas educacionais e tecnológicas na América do Sul.",
  },
}

export function SouthAmericaInteractiveMap() {
  const [activeCountry, setActiveCountry] = useState<CountryKey>(null)
  const [activeState, setActiveState] = useState<string | null>(null)

  return (
    <section className="relative w-full max-w-6xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

        {/* MAPA */}
        <div className="relative">
          <svg
            viewBox="0 0 400 500"
            className="w-full max-w-md mx-auto"
          >
            {/* BRASIL */}
            <path
              d="M160 120 L260 140 L300 230 L240 320 L180 300 L150 260 Z"
              className={`cursor-pointer transition-all
                ${activeCountry === "brasil"
                  ? "fill-cyan-500"
                  : "fill-cyan-500/40 hover:fill-cyan-500/70"}`}
              onClick={() => {
                setActiveCountry("brasil")
                setActiveState(null)
              }}
            />

            {/* PARAGUAI */}
            <path
              d="M190 260 L230 250 L240 290 L210 310 Z"
              className={`cursor-pointer transition-all
                ${activeCountry === "paraguai"
                  ? "fill-purple-500"
                  : "fill-purple-500/40 hover:fill-purple-500/70"}`}
              onClick={() => {
                setActiveCountry("paraguai")
                setActiveState(null)
              }}
            />

            {/* URUGUAI */}
            <path
              d="M210 320 L240 330 L230 360 L200 350 Z"
              className={`cursor-pointer transition-all
                ${activeCountry === "uruguai"
                  ? "fill-orange-500"
                  : "fill-orange-500/40 hover:fill-orange-500/70"}`}
              onClick={() => {
                setActiveCountry("uruguai")
                setActiveState(null)
              }}
            />
          </svg>

          <p className="text-center text-slate-400 mt-4">
            Clique em um país
          </p>
        </div>

        {/* PAINEL DE INFORMAÇÕES */}
        <div
          className="relative rounded-2xl p-6
          bg-white/5 backdrop-blur
          border border-white/10
          min-h-[280px]"
        >
          {!activeCountry && (
            <p className="text-slate-300">
              Selecione um país no mapa para ver mais informações.
            </p>
          )}

          {activeCountry && (
            <>
              <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {countryData[activeCountry].name}
              </h3>

              <p className="text-slate-300 mt-4">
                {countryData[activeCountry].description}
              </p>

              {/* ESTADOS DO BRASIL */}
              {activeCountry === "brasil" && (
                <div className="mt-6">
                  <p className="text-sm text-slate-400 mb-2">
                    Estados:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {countryData.brasil.states!.map((state) => (
                      <button
                        key={state}
                        onClick={() => setActiveState(state)}
                        className={`px-3 py-1 rounded-full text-sm transition
                          ${
                            activeState === state
                              ? "bg-cyan-500 text-white"
                              : "bg-white/10 text-slate-200 hover:bg-cyan-500/40"
                          }`}
                      >
                        {state}
                      </button>
                    ))}
                  </div>

                  {activeState && (
                    <p className="mt-4 text-slate-300">
                      📍 Estado selecionado:{" "}
                      <span className="text-cyan-400 font-semibold">
                        {activeState}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
