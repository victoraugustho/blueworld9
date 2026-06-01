"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

type ConfirmVariant = "default" | "danger"

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

type InternalConfirmOptions = Required<ConfirmOptions>

const DEFAULT_OPTIONS: InternalConfirmOptions = {
  title: "Confirmar ação",
  description: "Tem certeza que deseja continuar?",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  variant: "default",
}

function normalizeOptions(options: ConfirmOptions | string): InternalConfirmOptions {
  if (typeof options === "string") {
    return {
      ...DEFAULT_OPTIONS,
      description: options,
    }
  }
  return {
    title: options.title ?? DEFAULT_OPTIONS.title,
    description: options.description ?? DEFAULT_OPTIONS.description,
    confirmText: options.confirmText ?? DEFAULT_OPTIONS.confirmText,
    cancelText: options.cancelText ?? DEFAULT_OPTIONS.cancelText,
    variant: options.variant ?? DEFAULT_OPTIONS.variant,
  }
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<InternalConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback((value: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    if (resolver) resolver(value)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(normalizeOptions(opts))
    })
  }, [])

  useEffect(() => {
    return () => {
      if (resolverRef.current) resolverRef.current(false)
      resolverRef.current = null
    }
  }, [])

  const confirmDialog = options ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar confirmação"
        onClick={() => close(false)}
      />
      <div className="relative z-[101] w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/95 p-5 text-white shadow-2xl">
        <h3 className="text-lg font-semibold">{options.title}</h3>
        <p className="mt-2 text-sm text-slate-300 whitespace-pre-line">{options.description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            className="bg-white/10 hover:bg-white/15 border border-white/10"
            onClick={() => close(false)}
          >
            {options.cancelText}
          </Button>
          <Button
            type="button"
            className={
              options.variant === "danger"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-cyan-600 hover:bg-cyan-700"
            }
            onClick={() => close(true)}
          >
            {options.confirmText}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, confirmDialog }
}

