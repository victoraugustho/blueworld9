import { requireRestrictedAdminPage } from "@/lib/auth/restricted-admin-server"
import BugReportsClient from "./BugReportsClient"

export default async function BugReportsPage() {
  await requireRestrictedAdminPage()

  return <BugReportsClient />
}

