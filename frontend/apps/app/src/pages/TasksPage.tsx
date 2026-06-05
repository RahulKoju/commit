export function TasksPage() {
  return <Page title="Tasks" description="Task views will be implemented in Phase 2." />
}

function Page({ title, description }: { title: string; description: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </section>
  )
}
