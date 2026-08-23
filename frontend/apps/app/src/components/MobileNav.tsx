import { Logo } from "@workspace/ui/components/logo"
import { Sheet, SheetContent } from "@workspace/ui/components/sheet"

import { NavItems } from "@/components/nav-items"

export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 sm:max-w-xs">
        <div className="border-b px-5 py-4">
          <Logo />
        </div>
        <nav className="space-y-1 p-3" aria-label="Mobile navigation">
          <NavItems onNavigate={() => onOpenChange(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  )
}