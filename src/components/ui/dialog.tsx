// Dialog/Modal simple basado en createPortal y state controlado.
// Reemplazo de shadcn dialog que tenía issues con base-ui.

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handleEsc)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>,
    document.body
  )
}

function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string
  children: ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className={cn(
        "relative mx-4 rounded-xl bg-white p-6 shadow-xl ring-1 ring-neutral-200",
        className
      )}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Cerrar"
        >
          <XIcon className="h-5 w-5" />
        </button>
      )}
      {children}
    </div>
  )
}

function DialogHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-4 space-y-1", className)}>{children}</div>
}

function DialogTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2 className={cn("text-lg font-semibold text-neutral-900", className)}>
      {children}
    </h2>
  )
}

function DialogDescription({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <p className={cn("text-sm text-neutral-500", className)}>{children}</p>
  )
}

function DialogFooter({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
