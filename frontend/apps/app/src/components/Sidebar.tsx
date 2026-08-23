import { Logo } from "@workspace/ui/components/logo"

import { NavItems } from "@/components/nav-items"

export function Sidebar() {
  return (
    <aside className="hidden min-h-svh w-64 border-r bg-background lg:block">
      <div className="h-16 border-b px-5 py-4">
        <Logo />
      </div>
      <nav className="space-y-1 p-3">
        <NavItems />
      </nav>
    </aside>
  )
}
