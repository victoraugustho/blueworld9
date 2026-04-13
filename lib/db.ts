import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

type DbClient = ReturnType<typeof postgres>

declare global {
  // eslint-disable-next-line no-var
  var __bw9DbClient: DbClient | undefined
}

function createDbClient(connectionString: string) {
  const isDev = process.env.NODE_ENV !== "production"
  const defaultPoolMax = isDev ? 2 : 10
  const parsedPoolMax = Number(process.env.DB_POOL_MAX ?? defaultPoolMax)
  const poolMax =
    Number.isFinite(parsedPoolMax) && parsedPoolMax > 0
      ? Math.floor(parsedPoolMax)
      : defaultPoolMax

  return postgres(connectionString, {
    ssl: false,
    max: poolMax,
    idle_timeout: Number(process.env.DB_IDLE_TIMEOUT_SECONDS ?? 10),
    connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT_SECONDS ?? 10),
    onnotice: () => {},
  })
}

export const db = globalThis.__bw9DbClient ?? createDbClient(databaseUrl ?? "")

if (process.env.NODE_ENV !== "production") {
  globalThis.__bw9DbClient = db
}
