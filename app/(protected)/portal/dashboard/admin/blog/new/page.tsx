import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import NewBlogPostClient from "./NewBlogPostClient"

export default async function NewBlogPostPage() {
  await requireRestrictedAdminPage()
  return <NewBlogPostClient />
}


