import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import BlogPostsListClient from "./BlogPostsListClient"

export default async function BlogPostsPage() {
  await requireRestrictedAdminPage()
  return <BlogPostsListClient />
}

