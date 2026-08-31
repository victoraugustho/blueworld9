type SchemaEnsureMap = Map<string, Promise<void>>
type SchemaWarnedKeys = Set<string>

declare global {
  // eslint-disable-next-line no-var
  var __bw9SchemaEnsureMap: SchemaEnsureMap | undefined
  // eslint-disable-next-line no-var
  var __bw9SchemaEnsureWarned: SchemaWarnedKeys | undefined
}

function getSchemaEnsureMap() {
  if (!globalThis.__bw9SchemaEnsureMap) {
    globalThis.__bw9SchemaEnsureMap = new Map<string, Promise<void>>()
  }
  return globalThis.__bw9SchemaEnsureMap
}

function getSchemaWarnedSet() {
  if (!globalThis.__bw9SchemaEnsureWarned) {
    globalThis.__bw9SchemaEnsureWarned = new Set<string>()
  }
  return globalThis.__bw9SchemaEnsureWarned
}

function canMutateRuntimeSchema() {
  if (process.env.NODE_ENV === "production") {
    return false
  }
  const raw = String(process.env.ENABLE_RUNTIME_SCHEMA_WRITES ?? "").trim().toLowerCase()
  const explicitlyEnabled = raw === "true" || raw === "1" || raw === "yes" || raw === "on"
  return explicitlyEnabled
}

export async function ensureRuntimeSchema(key: string, run: () => Promise<void>) {
  if (!canMutateRuntimeSchema()) {
    const warned = getSchemaWarnedSet()
    if (!warned.has(key)) {
      warned.add(key)
      const guidance =
        process.env.NODE_ENV === "production"
          ? "Apply the matching SQL migration during controlled maintenance before deployment."
          : "Set ENABLE_RUNTIME_SCHEMA_WRITES=true only during controlled local maintenance."
      console.warn(
        `[runtime-schema] mutation skipped for "${key}". ${guidance}`,
      )
    }
    return
  }

  const cache = getSchemaEnsureMap()
  const existing = cache.get(key)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    await run()
  })()

  cache.set(key, promise)

  try {
    await promise
  } catch (error) {
    cache.delete(key)
    throw error
  }
}
