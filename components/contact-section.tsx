"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, MapPin, Instagram, Linkedin, Youtube, Phone, Send, Sparkles, Rocket, Star, Heart } from "lucide-react"

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    school: "",
    city: "",
    phone: "",
    email: "",
    message: "",
  })

  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório"
    if (!formData.school.trim()) newErrors.school = "Escola é obrigatória"
    if (!formData.city.trim()) newErrors.city = "Cidade é obrigatória"
    if (!formData.phone.trim()) newErrors.phone = "Telefone é obrigatório"
    if (!formData.email.trim()) {
      newErrors.email = "E-mail é obrigatório"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "E-mail inválido"
    }
    if (!formData.message.trim()) newErrors.message = "Mensagem é obrigatória"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // Send to n8n webhook
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://your-n8n-instance.com/webhook/contact"

      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
        }),
      })

      // Redirect to WhatsApp with pre-filled message
      const whatsappNumber = "5511999999999" // Replace with your WhatsApp number
      const whatsappMessage = encodeURIComponent(
        `Olá! Sou ${formData.name} da escola ${formData.school} em ${formData.city}. ${formData.message}`,
      )
      window.open(`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`, "_blank")

      // Reset form
      setFormData({ name: "", school: "", city: "", phone: "", email: "", message: "" })
      setErrors({})
    } catch (error) {
      console.error("Error submitting form:", error)
      alert("Erro ao enviar formulário. Por favor, tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" })
    }
  }

  return (
    <section
      id="contato"
      className="relative py-20 md:py-32 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Icons */}
        <Send
          className="absolute top-20 left-[10%] w-8 h-8 text-cyan-400/30 animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <Mail
          className="absolute top-40 right-[15%] w-10 h-10 text-orange-400/30 animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "3.5s" }}
        />
        <Heart
          className="absolute bottom-32 left-[20%] w-6 h-6 text-pink-400/30 animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "2.5s" }}
        />
        <Star
          className="absolute top-[30%] right-[25%] w-7 h-7 text-yellow-400/30 animate-bounce"
          style={{ animationDelay: "1.5s", animationDuration: "3s" }}
        />
        <Sparkles
          className="absolute bottom-40 right-[10%] w-8 h-8 text-purple-400/30 animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "2.8s" }}
        />
        <Rocket
          className="absolute top-[60%] left-[15%] w-9 h-9 text-blue-400/30 animate-bounce"
          style={{ animationDelay: "0.8s", animationDuration: "3.2s" }}
        />

        {/* Gradient Orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-6xl bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Vamos Conversar?
          </h2>
          <p className="text-lg md:text-xl text-white/80 leading-relaxed">
            Estamos prontos para transformar a educação da sua escola com tecnologia e inovação
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-2">
                  Nome Completo *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="school" className="block text-sm font-medium text-white/90 mb-2">
                  Escola *
                </label>
                <Input
                  id="school"
                  name="school"
                  type="text"
                  value={formData.school}
                  onChange={handleChange}
                  placeholder="Nome da escola"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.school && <p className="text-red-400 text-sm mt-1">{errors.school}</p>}
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-white/90 mb-2">
                  Cidade *
                </label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Sua cidade"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-white/90 mb-2">
                  Telefone/WhatsApp *
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                  E-mail *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-white/90 mb-2">
                  Mensagem *
                </label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Como podemos ajudar sua escola?"
                  rows={4}
                  className="bg-slate-900/50 border-white/10 text-white placeholder:text-white/40"
                />
                {errors.message && <p className="text-red-400 text-sm mt-1">{errors.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                size="lg"
              >
                {isLoading ? "Enviando..." : "Enviar e Falar no WhatsApp"}
              </Button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-8">
              <h3 className="font-heading font-bold text-2xl text-cyan-400 mb-6">Informações de Contato</h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white/90">E-mail</p>
                    <a
                      href="mailto:contato@bw9global.com"
                      className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      contato@bw9global.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white/90">WhatsApp</p>
                    <a
                      href="https://wa.me/5511999999999"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      +55 (11) 99999-9999
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white/90">Localização</p>
                    <p className="text-white/70">América Latina</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-8">
              <h3 className="font-heading font-bold text-2xl text-purple-400 mb-6">Redes Sociais</h3>

              <div className="flex gap-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                >
                  <Instagram className="w-7 h-7 text-white" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                >
                  <Linkedin className="w-7 h-7 text-white" />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                >
                  <Youtube className="w-7 h-7 text-white" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
