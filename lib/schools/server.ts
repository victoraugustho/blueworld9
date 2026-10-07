import { db } from '@/lib/db'
import { schoolService, type SchoolConnection, type SchoolDatabase } from './service'

export const schoolsEnabled = () => process.env.SCHOOLS_MODULE_ENABLED === 'true'
const connection = (sql: typeof db): SchoolConnection => ({
  async query(text, values = []) { return Array.from(await sql.unsafe(text, values)) },
})
const database: SchoolDatabase = {
  ...connection(db),
  async transaction<T>(work: (c: SchoolConnection) => Promise<T>): Promise<T> {
    return await db.begin(async sql => work(connection(sql as unknown as typeof db))) as T
  },
}
export const schools = schoolService(database)
