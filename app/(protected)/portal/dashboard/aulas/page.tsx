import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function extractYouTubeId(url: string): string | null {
  try {
    if (url.includes("watch?v=")) {
      return url.split("watch?v=")[1].split("&")[0];
    }
    if (url.includes("youtu.be/")) {
      return url.split("youtu.be/")[1].split("?")[0];
    }
    return null;
  } catch {
    return null;
  }
}

export default async function AulasPage() {
  const teacherId = (await cookies()).get("teacher_id")?.value;

  if (!teacherId) redirect("/portal/login");

  const [teacher] = await db`
    SELECT * FROM teachers WHERE id = ${teacherId}
  `;

  if (!teacher || !teacher.approved) redirect("/portal/login");

  // Agora traz categorias + materiais relacionados
  const rows = await db`
    SELECT m.*, c.name AS category_name
    FROM materials m
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE m.file_type = 'video'
    ORDER BY c.name ASC, m.created_at DESC
  `;

  // Agrupar por categoria
  const categorias = rows.reduce((acc: any, mat: any) => {
    const cat = mat.category_name || "Sem Categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mat);
    return acc;
  }, {});

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold text-white mb-8">Aulas em Vídeo</h1>

      {Object.keys(categorias).map((categoria) => (
        <div key={categoria} className="mb-12">
          
          <h2 className="text-2xl font-semibold text-cyan-400 mb-4">{categoria}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {categorias[categoria].map((video: any) => {
              const id = extractYouTubeId(video.file_url);
              const embed = id ? `https://www.youtube.com/embed/${id}` : null;

              return (
                <div
                  key={video.id}
                  className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 backdrop-blur-xl shadow-xl"
                >
                  {embed ? (
                    <iframe
                      className="rounded-lg w-full aspect-video mb-4"
                      src={embed}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="text-red-400 mb-4">
                      URL inválida ou não é do YouTube.
                    </div>
                  )}

                  <h2 className="text-xl font-semibold text-white">
                    {video.title}
                  </h2>

                  <p className="text-slate-300 mt-1">{video.description}</p>

                  <span className="inline-block mt-3 px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                    {categoria}
                  </span>
                </div>
              );
            })}

          </div>
        </div>
      ))}

    </div>
  );
}
