"use client";

import { useEffect, useState } from "react";
import { Material, Category } from "@/app/types/portal";
import { Plus } from "lucide-react";

interface MaterialForm {
  title: string;
  description: string;
  file_url: string;
  file_type: "video" | "document";
  category_id: string;
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [form, setForm] = useState<MaterialForm>({
    title: "",
    description: "",
    file_url: "",
    file_type: "video",
    category_id: "",
  });

  async function loadData() {
    const res = await fetch("/api/admin/materials");
    const data = await res.json();

    setMaterials(data.materials || []);
    setCategories(data.categories || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  // 🔧 Handler genérico para todos os campos
  function updateForm<K extends keyof MaterialForm>(
    key: K,
    value: MaterialForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await fetch("/api/admin/materials", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
        new_category: newCategory || null,
      }),
    });

    // RESET LIMPO
    setForm({
      title: "",
      description: "",
      file_url: "",
      file_type: "video",
      category_id: "",
    });

    setNewCategory("");
    setNewCategoryOpen(false);
    loadData();
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">Gerenciar Materiais</h1>

      {/* CARD DO FORM */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">

        <form onSubmit={submitForm} className="grid gap-5">

          {/* TÍTULO */}
          <div>
            <label className="text-sm text-slate-300">Título</label>
            <input
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-cyan-500 outline-none"
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              required
            />
          </div>

          {/* DESCRIÇÃO */}
          <div>
            <label className="text-sm text-slate-300">Descrição</label>
            <textarea
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-cyan-500 outline-none"
              rows={3}
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-sm text-slate-300">URL do Arquivo / Vídeo</label>
            <input
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-cyan-500 outline-none"
              value={form.file_url}
              onChange={(e) => updateForm("file_url", e.target.value)}
              required
            />
          </div>

          {/* FILE TYPE */}
          <div>
            <label className="text-sm text-slate-300">Tipo</label>
            <select
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1"
              value={form.file_type}
              onChange={(e) =>
                updateForm("file_type", e.target.value as "video" | "document")
              }
            >
              <option value="video">Vídeo (YouTube)</option>
              <option value="document">Documento</option>
            </select>
          </div>

          {/* CATEGORIA */}
          <div>
            <label className="text-sm text-slate-300">Categoria</label>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-1"
                value={form.category_id}
                onChange={(e) => updateForm("category_id", e.target.value)}
              >
                <option value="">Selecione...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setNewCategoryOpen((v) => !v)}
                className="px-3 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-700 mt-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {newCategoryOpen && (
              <input
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 mt-3"
                placeholder="Nova categoria"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            )}
          </div>

          {/* BOTÃO */}
          <button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-2 rounded-lg hover:opacity-90 transition">
            Salvar Material
          </button>
        </form>
      </div>

      {/* LISTAGEM */}
      <h2 className="text-2xl mt-10 font-bold">Materiais Cadastrados</h2>
      <ul className="mt-4 space-y-2">
        {materials.map((m) => (
          <li
            key={m.id}
            className="p-4 bg-slate-800/40 border border-slate-700 rounded-xl"
          >
            <p className="text-lg">{m.title}</p>
            <span className="text-cyan-400 text-sm">{m.category_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
