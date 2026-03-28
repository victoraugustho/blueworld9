type SchemaEnsureMap = Map<string, Promise<void>>

declare global {
  // eslint-disable-next-line no-var
  var __bw9SchemaEnsureMap: SchemaEnsureMap | undefined
}

function getSchemaEnsureMap() {
  if (!globalThis.__bw9SchemaEnsureMap) {
    globalThis.__bw9SchemaEnsureMap = new Map<string, Promise<void>>()
  }
  return globalThis.__bw9SchemaEnsureMap
}

export async function ensureRuntimeSchema(key: string, run: () => Promise<void>) {
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

