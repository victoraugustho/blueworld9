import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import BlogAdminClient from "./BlogAdminClient"

export default async function AdminBlogPage() {
  await requireRestrictedAdminPage()
  return <BlogAdminClient />
}

