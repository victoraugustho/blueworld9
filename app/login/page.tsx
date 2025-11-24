"use client"

import type React from "react"

import { useState } from "react"
import { AnimatedBackground } from "@/components/animated-background"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Lock, Mail, User, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
  })

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }

  const validateForm = () => {
    const newErrors = { name: "", email: "", password: "" }
    let isValid = true

    if (!isLogin && !formData.name.trim()) {
      newErrors.name = "Nome é obrigatório"
      isValid = false
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório"
      isValid = false
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Email inválido"
      isValid = false
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória"
      isValid = false
    } else if (formData.password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres"
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      console.log("[v0] Form submitted:", formData)
      // Aqui você implementaria a lógica de autenticação
      alert(isLogin ? "Login realizado com sucesso!" : "Cadastro realizado com sucesso!")
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Limpa o erro do campo quando o usuário começa a digitar
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden py-20 px-4">
      <AnimatedBackground variant="default" />

      {/* Floating icons around the form */}
      <div className="absolute top-20 left-10 w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl opacity-20 blur-xl animate-[float_6s_ease-in-out_infinite]" />
      <div className="absolute bottom-32 right-20 w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full opacity-20 blur-xl animate-[float_8s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 right-10 w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg opacity-20 blur-lg animate-[float_7s_ease-in-out_infinite]" />

      <div className="relative z-10 w-full max-w-md pt-20">
        {/* Card Container */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 mb-4 shadow-lg shadow-cyan-500/50">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
              {isLogin ? "Bem-vindo de Volta!" : "Criar Conta"}
            </h1>
            <p className="text-slate-300 text-sm">
              {isLogin ? "Entre com suas credenciais para continuar" : "Preencha os dados para criar sua conta"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field - Only for Register */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/90 text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  Nome Completo
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/50 transition-all ${
                    errors.name ? "border-red-400 focus:border-red-400 focus:ring-red-400/50" : ""
                  }`}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90 text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                className={`bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/50 transition-all ${
                  errors.email ? "border-red-400 focus:border-red-400 focus:ring-red-400/50" : ""
                }`}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/50 transition-all pr-10 ${
                    errors.password ? "border-red-400 focus:border-red-400 focus:ring-red-400/50" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Forgot Password - Only for Login */}
            {isLogin && (
              <div className="flex justify-end">
                <Link href="#" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 text-white font-semibold py-6 rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 group"
            >
              {isLogin ? "Entrar" : "Criar Conta"}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900/50 text-slate-400">OU</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-1">
            <Button
              type="button"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </div>

          {/* Toggle Login/Register */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setErrors({ name: "", email: "", password: "" })
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors hover:underline"
              >
                {isLogin ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>
        </div>

        {/* Back to Home Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-slate-400 hover:text-white text-sm inline-flex items-center gap-2 transition-colors group"
          >
            <svg
              className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar para Home
          </Link>
        </div>
      </div>
    </main>
  )
}
