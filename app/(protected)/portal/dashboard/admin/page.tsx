import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle, FileText, BookOpen, Video, LogOut, User } from "lucide-react";
import Link from "next/link";

export default async function PortalDashboardPage() {
  const cookieStore = await cookies();
  const teacherId = cookieStore.get("teacher_id")?.value;

  if (!teacherId) {
    redirect("/portal/login");
  }

  // Buscar teacher no banco
  const [teacher] = await db`
    SELECT * FROM teachers WHERE id = ${teacherId}
  `;

  if (!teacher || !teacher.approved) {
    redirect("/portal/login");
  }

  // Buscar materials
  const materials = await db`
    SELECT * FROM materials ORDER BY created_at DESC
  `;

  const videos = materials.filter((m) => m.file_type === "video");
  const documents = materials.filter((m) => m.file_type === "document");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">{teacher.name}</h1>
              <p className="text-sm text-slate-400">{teacher.email}</p>
            </div>
          </div>
          <form action="/api/portal/logout" method="POST">
            <Button
              type="submit"
              variant="outline"
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Portal do Professor
          </h2>
          <p className="text-slate-300">Acesse vídeos e materiais de apoio para suas aulas</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Video className="w-5 h-5" />
                Vídeos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{videos.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-600/10 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <FileText className="w-5 h-5" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{documents.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-600/10 border-orange-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <BookOpen className="w-5 h-5" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{materials.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Videos */}
        <section className="mb-8">
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <PlayCircle className="w-6 h-6 text-cyan-400" />
            Vídeos de Apoio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card
                key={video.id}
                className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all group"
              >
                <CardHeader>
                  {video.thumbnail_url && (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-40 object-cover rounded-lg mb-2"
                    />
                  )}
                  <CardTitle className="text-white group-hover:text-cyan-400 transition-colors">
                    {video.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400">{video.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-block px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full mb-3">
                    {video.category}
                  </span>
                  <Link href={video.file_url} target="_blank">
                    <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Assistir
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Documents */}
        <section>
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" />
            Materiais de Apoio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    {doc.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400">{doc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                      {doc.category}
                    </span>
                    <Link href={doc.file_url} target="_blank">
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                      >
                        Visualizar
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
