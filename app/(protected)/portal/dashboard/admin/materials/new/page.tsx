"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "@/app/types/portal";

export default function NewMaterialPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCat, setIsLoadingCat] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    file_url: "",
    file_type: "video",
    category_id: "",
    new_category: "",
  });

  const [newCategoryName, setNewCategoryName] = useState("");

  /** 📌 Carrega categorias */
  async function loadCategories() {
    const res = await fetch("/api/admin/categories", { cache: "no-store" });
    const data = await res.json();
    setCategories(data ?? []);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  /** 📌 Criar material */
  async function submitMaterial(e: React.FormEvent) {
    e.preventDefault();

    await fetch("/api/admin/materials/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    router.push("/portal/dashboard/admin/materials");
  }

  /** 📌 Criar categoria separadamente */
  async function createCategory(e: React.FormEvent) {
    e.preventDefault();

    if (!newCategoryName.trim()) return;

    setIsLoadingCat(true);

    const res = await fetch("/api/admin/categories/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });

    setIsLoadingCat(false);

    if (res.ok) {
      setNewCategoryName("");
      loadCategories(); // 🔄 Atualiza a lista no select
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row gap-10 items-start justify-center px-4 py-10 text-white">

      {/* ========================== */}
      {/* 🎬 CARD 1 — NOVO MATERIAL */}
      {/* ========================== */}
      <Card className="w-full max-w-2xl bg-slate-900/20 backdrop-blur-xl border border-cyan-500/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Novo Material
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form className="space-y-6" onSubmit={submitMaterial}>

            {/* TÍTULO */}
            <div className="space-y-2">
              <Label className="text-white">Título</Label>
              <Input
                placeholder="Ex: Introdução à Robótica"
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            {/* DESCRIÇÃO */}
            <div className="space-y-2">
              <Label className="text-white">Descrição</Label>
              <Textarea
                placeholder="Descreva o material..."
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label className="text-white">URL</Label>
              <Input
                placeholder="https://youtube.com/..."
                className="bg-slate-800/50 border-slate-700 text-white"
                value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                required
              />
            </div>

            {/* TIPO */}
            <div className="space-y-2">
              <Label className="text-white">Tipo</Label>
              <select
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                value={form.file_type}
                onChange={(e) => setForm({ ...form, file_type: e.target.value })}
              >
                <option value="video">Vídeo (YouTube)</option>
                <option value="document">Documento</option>
              </select>
            </div>

            {/* CATEGORIA */}
            <div className="space-y-2">
              <Label className="text-white">Categoria</Label>
              <select
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-white"
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
              >
                <option value="">Selecione</option>

                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÃO */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6"
            >
              Salvar Material
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* =================================== */}
      {/* 🏷️ CARD 2 — CRIAÇÃO DE CATEGORIA */}
      {/* =================================== */}
      <Card className="w-full max-w-md bg-slate-900/20 backdrop-blur-xl border border-purple-500/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-purple-300">
            Criar Categoria
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={createCategory}>

            <div className="space-y-2">
              <Label className="text-white">Nome da Categoria</Label>
              <Input
                placeholder="Ex: Ciências, Robótica..."
                className="bg-slate-800/50 border-slate-700 text-white"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoadingCat}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 py-5"
            >
              {isLoadingCat ? "Salvando..." : "Criar Categoria"}
            </Button>

          </form>
        </CardContent>
      </Card>

    </div>
  );
}
