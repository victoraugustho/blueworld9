import EditMaterialPage from "./EditMaterialPage"

export default async function Page(context: any) {
  const { id } = await context.params
  return <EditMaterialPage params={{ id }} />
}
