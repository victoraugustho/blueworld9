import { redirect } from "next/navigation"

type Params = {
  params: Promise<{ id: string }>
}

export default async function NotasAulaDetalhePage({ params }: Params) {
  await params
  redirect("/portal/dashboard/notas/lancamentos")
}
