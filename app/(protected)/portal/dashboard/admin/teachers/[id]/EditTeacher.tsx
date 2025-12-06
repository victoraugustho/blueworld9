"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Teacher } from "@/app/types/portal";

export default function EditTeacherPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/teachers/${id}`);
      const data = await res.json();
      setTeacher(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`/api/admin/teachers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teacher),
    });

    router.push("/portal/dashboard/admin/teachers");
  }

  if (loading || !teacher)
    return <p className="text-white p-6">Carregando...</p>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">Editar Professor</h1>

        <form className="space-y-4" onSubmit={save}>
          <div>
            <Label className="text-white">Nome</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.name}
              onChange={(e) => setTeacher({ ...teacher, name: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-white">Email</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.email}
              onChange={(e) => setTeacher({ ...teacher, email: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-white">Telefone</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.phone}
              onChange={(e) => setTeacher({ ...teacher, phone: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-white">CPF</Label>
            <Input
              className="bg-white/10 border-white/20 text-white"
              value={teacher.cpf}
              onChange={(e) => setTeacher({ ...teacher, cpf: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={teacher.approved}
              onChange={(e) => setTeacher({ ...teacher, approved: e.target.checked })}
            />
            <Label className="text-white">Aprovado</Label>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg">
            Salvar
          </Button>
        </form>
      </div>
    </div>
  );
}
