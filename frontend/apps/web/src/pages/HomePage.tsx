import { ArrowRight, BookOpen, CheckCircle2, Clock, NotebookPen } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"

const features = [
  { icon: CheckCircle2, label: "Tasks and habits" },
  { icon: Clock, label: "Focus sessions" },
  { icon: BookOpen, label: "Learning logs" },
  { icon: NotebookPen, label: "Developer notes" },
]

export function HomePage() {
  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto grid min-h-svh max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-destructive">
              Push yourself. Every day.
            </p>
            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              Commit
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              A self-hosted productivity OS for developers to track work,
              habits, focus, learning, and notes from one dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Start now
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <feature.icon className="size-5 text-destructive" />
              <span className="font-medium">{feature.label}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
