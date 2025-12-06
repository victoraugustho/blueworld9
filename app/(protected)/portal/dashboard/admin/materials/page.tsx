"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Pencil, Trash } from "lucide-react";
import type { Material } from "@/app/types/portal";

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const res = await fetch("/api/admin/materials", { cache: "no-store" });
    const data = await res.json();

    setMaterials(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteMaterial(id: string) {
    if (!confirm("Tem certeza que deseja excluir este material?")) return;

    const res = await fetch(`/api/admin/materials/${id}`, {
      method: "DELETE",
    });

    if (res.ok) load();
    else alert("Erro ao excluir material");
  }

  return (
    <div className="p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Materiais</h1>

        <Link href="/portal/dashboard/admin/materials/new">
          <Button className="bg-cyan-600 hover:bg-cyan-700">Novo Material</Button>
        </Link>
      </div>

      {loading && <p className="text-slate-400 animate-pulse">Carregando...</p>}

      {!loading && materials.length === 0 && (
        <p className="text-slate-400">Nenhum material cadastrado.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {materials.map((m) => (
          <Card key={m.id} className="bg-slate-800/20 border-slate-700 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">{m.title}</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-slate-300 mb-3">{m.description}</p>

              <span className="inline-block mb-4 px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400">
                {m.category_name ?? "Sem categoria"}
              </span>

              <div className="flex justify-between">
                <Link href={`/portal/dashboard/admin/materials/edit/${m.id}`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                    <Pencil className="w-4 h-4" /> Editar
                  </Button>
                </Link>

                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                  onClick={() => deleteMaterial(m.id)}
                >
                  <Trash className="w-4 h-4" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
