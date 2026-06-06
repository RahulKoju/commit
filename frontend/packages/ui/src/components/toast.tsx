import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: "border-border bg-background text-foreground shadow-lg",
        duration: 4000,
      }}
    />
  )
}
