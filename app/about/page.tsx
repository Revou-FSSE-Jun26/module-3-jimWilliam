import type { Metadata } from "next";
import Link from "next/link";
import ArrayLab from "@/components/about/ArrayLab";
import { AboutAdminBar } from "@/components/admin/PageAdminBars";
import ContactForm from "@/components/about/ContactForm";
import DomLab from "@/components/about/DomLab";
import Card from "@/components/ui/Card";
import { serverApi } from "@/lib/api.server";
import { buttonVariants } from "@/lib/classes";

export const metadata: Metadata = {
  title: "About me",
  description: "Jim — frontend developer behind RevoTech. Profile, skills, projects, and the Checkpoint 1 fundamentals.",
};

// Rendering strategy: fully static. Built once at deploy time; nothing here changes per request.
// The profile, skills and projects are editable content: saving them expires the page's cache
// tag, and the next visit rebuilds it once (on-demand revalidation) - it is still static.
export const dynamic = "force-static";

export default async function AboutPage() {
  const [products, categories, about] = await Promise.all([
    serverApi.products({}, { cache: "force-cache" }),
    serverApi.categories({ cache: "force-cache" }),
    serverApi.about({ cache: "force-cache" }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-20 px-4 py-10 sm:px-6">
      <div className="mb-6! empty:hidden">
        <AboutAdminBar />
      </div>

      {/* profile */}
      <header className="panel relative overflow-hidden p-8 sm:p-12">
        <div className="absolute -top-20 -left-20 size-72 rounded-full bg-cyan/15 blur-3xl" aria-hidden />
        <div className="absolute -right-16 -bottom-24 size-72 rounded-full bg-magenta/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
          <div
            className="grid size-28 shrink-0 place-items-center rounded-3xl bg-linear-to-br from-cyan to-magenta font-mono text-5xl font-bold text-void shadow-[0_0_60px_-10px_var(--color-cyan)]"
            aria-hidden
          >
            {about.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-3">
            <p className="font-mono text-xs tracking-[0.24em] text-cyan uppercase">Module 3 · About me</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl" data-testid="about-name">
              {about.name}
            </h1>
            <p className="font-mono text-sm text-magenta">{about.tagline}</p>
            <p className="max-w-2xl whitespace-pre-line text-dim" data-testid="about-intro">
              {about.intro}
            </p>
          </div>
        </div>
        <dl className="relative mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6 sm:max-w-md">
          <div>
            <dt className="font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">Products</dt>
            <dd className="font-mono text-3xl text-lime">{products.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">Categories</dt>
            <dd className="font-mono text-3xl text-lime">{categories.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] tracking-[0.16em] text-faint uppercase">Checkpoints</dt>
            <dd className="font-mono text-3xl text-lime">3</dd>
          </div>
        </dl>
      </header>

      {/* skills - two-dimensional grid */}
      <section aria-labelledby="skills">
        <SectionTitle id="skills" eyebrow="Toolkit">
          Skills
        </SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {about.skills.map((s, i) => (
            <li key={i}>
              <Card interactive className="h-full p-5">
                <h3 className="font-semibold">{s.name}</h3>
                <p className="mt-1.5 text-sm text-dim">{s.note}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* projects */}
      <section aria-labelledby="projects">
        <SectionTitle id="projects" eyebrow="Work">
          Projects
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {about.projects.map((p, i) => (
            <Card as="article" key={i} interactive accent="#e879f9" className="flex flex-col gap-2 p-6">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="font-mono text-xs text-cyan">{p.meta}</p>
              <p className="flex-1 text-sm text-dim">{p.body}</p>
              <Link href={p.href} className="mt-2 font-mono text-xs text-magenta hover:underline">
                Open →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* checkpoint 1 */}
      <section aria-labelledby="checkpoint-1" className="space-y-8">
        <SectionTitle id="checkpoint-1" eyebrow="Checkpoint 1">
          Fundamentals lab
        </SectionTitle>
        <p className="-mt-4 max-w-3xl text-dim">
          The building blocks under everything else on this site. The same profile, written as a single plain HTML and CSS file with
          no framework — semantic elements, the box model, Grid, Flexbox and responsive breakpoints — is{" "}
          <a href="/checkpoint-1/index.html" className="text-cyan underline-offset-4 hover:underline">
            here
          </a>
          .
        </p>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card className="space-y-4 p-6">
            <div>
              <h3 className="font-mono text-sm text-magenta">DOM & events</h3>
              <p className="mt-1 text-sm text-dim">
                Plain <code className="text-cyan">querySelector</code>, <code className="text-cyan">createElement</code>,{" "}
                <code className="text-cyan">classList.toggle</code> and <code className="text-cyan">remove()</code>, wired with{" "}
                <code className="text-cyan">addEventListener</code>. Click an item to toggle it.
              </p>
            </div>
            <DomLab />
          </Card>
          <div className="space-y-2">
            <h3 className="font-mono text-sm text-magenta">Array methods over the live catalogue</h3>
            <ArrayLab products={products} categories={categories} />
          </div>
        </div>

        <a href="/checkpoint-1/index.html" className={buttonVariants.secondary}>
          Open the plain HTML/CSS version →
        </a>
      </section>

      {/* contact */}
      <section aria-labelledby="contact" className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionTitle id="contact" eyebrow="Say hello">
            Contact
          </SectionTitle>
          <p className="-mt-4 text-dim">Questions about the project, or spotted something broken? Send a note.</p>
        </div>
        <Card className="p-6 sm:p-8">
          <ContactForm />
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ id, eyebrow, children }: { id: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="font-mono text-xs tracking-[0.24em] text-cyan uppercase">
        <span className="text-faint">{"//"}</span> {eyebrow}
      </p>
      <h2 id={id} className="mt-2 text-3xl font-semibold tracking-tight">
        {children}
      </h2>
    </div>
  );
}
