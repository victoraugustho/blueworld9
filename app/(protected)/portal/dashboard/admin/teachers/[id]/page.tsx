import EditTeacherPage from "./EditTeacher"

export default async function Page(context: any) {
  const { id } = await context.params;
  return <EditTeacherPage params={{ id }} />;
}
