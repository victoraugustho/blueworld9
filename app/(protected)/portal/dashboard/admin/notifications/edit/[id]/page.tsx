import NotificationForm from "../../NotificationForm"

export default function EditNotificationPage({ params }: { params: { id: string } }) {
  return <NotificationForm id={params.id} />
}
