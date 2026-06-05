export function DashboardPage() {
  return <Page title="Dashboard" description="Live widgets will be wired in Phase 8." />
}

function Page({ title, description }: { title: string; description: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </section>
  )
}
