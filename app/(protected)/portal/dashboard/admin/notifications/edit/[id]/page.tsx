import NotificationForm from "../../NotificationForm"

type PageProps = { params: Promise<{ id: string }> }

export default async function EditNotificationPage({ params }: PageProps) {
  const { id } = await params
  return <NotificationForm id={id} />
}
