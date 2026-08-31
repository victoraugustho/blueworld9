import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import EditBlogPostClient from "./EditBlogPostClient"

type Props = { params: Promise<{ id: string }> }

export default async function EditBlogPostPage({ params }: Props) {
  await requireRestrictedAdminPage()
  const resolved = await params
  return <EditBlogPostClient postId={String(resolved?.id ?? "")} />
}

