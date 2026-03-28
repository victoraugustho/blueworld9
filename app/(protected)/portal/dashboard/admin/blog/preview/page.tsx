import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import BlogPreviewClient from "./BlogPreviewClient"

export default async function BlogPreviewPage() {
  await requireRestrictedAdminPage()
  return <BlogPreviewClient />
}


