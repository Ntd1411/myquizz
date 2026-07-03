/**
 * Design System Showcase Page
 * Demo các design tokens, colors, typography, spacing
 */

export function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-bg py-12">
      <div className="container">
        <h1 className="mb-8">MyQuizz Design System</h1>

        {/* Colors Section */}
        <section className="mb-16">
          <h2 className="mb-6">Colors</h2>

          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl">Primary (Brand Identity)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ColorSwatch name="Primary" className="bg-primary text-white" />
              <ColorSwatch name="Hover" className="bg-primary-hover text-white" />
              <ColorSwatch name="Active" className="bg-primary-active text-white" />
              <ColorSwatch name="Subtle" className="bg-primary-subtle text-ink" />
              <ColorSwatch name="Border" className="bg-primary-border text-white" />
            </div>
          </div>

          {/* Accent Colors */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl">Accent (Achievement Glow)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ColorSwatch name="Accent" className="bg-accent text-ink" />
              <ColorSwatch name="Hover" className="bg-accent-hover text-ink" />
              <ColorSwatch name="Active" className="bg-accent-active text-ink" />
              <ColorSwatch name="Subtle" className="bg-accent-subtle text-ink" />
              <ColorSwatch name="Border" className="bg-accent-border text-white" />
            </div>
          </div>

          {/* Semantic Colors */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl">Semantic Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Success" className="bg-success text-white" />
              <ColorSwatch name="Warning" className="bg-warning text-ink" />
              <ColorSwatch name="Danger" className="bg-danger text-white" />
              <ColorSwatch name="Info" className="bg-info text-white" />
            </div>
          </div>

          {/* Surface Colors */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl">Surface & Ink</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Background" className="bg-bg border border-border text-ink" />
              <ColorSwatch name="Surface" className="bg-surface text-ink" />
              <ColorSwatch name="Ink" className="bg-ink text-white" />
              <ColorSwatch name="Ink Muted" className="bg-ink-muted text-white" />
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className="mb-16">
          <h2 className="mb-6">Typography</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-ink-muted mb-2">Heading 1</p>
              <h1>The quick brown fox jumps</h1>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-2">Heading 2</p>
              <h2>The quick brown fox jumps</h2>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-2">Heading 3</p>
              <h3>The quick brown fox jumps</h3>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-2">Heading 4</p>
              <h4>The quick brown fox jumps</h4>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-2">Body Text</p>
              <p>
                The quick brown fox jumps over the lazy dog. This is a sample paragraph to demonstrate
                body text styling with proper line height and spacing for optimal readability.
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-muted mb-2">Muted Text</p>
              <p className="text-ink-muted">
                This is muted text used for secondary information and supporting content.
              </p>
            </div>
          </div>
        </section>

        {/* Spacing Section */}
        <section className="mb-16">
          <h2 className="mb-6">Spacing Scale</h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32].map((size) => (
              <div key={size} className="flex items-center gap-4">
                <span className="text-sm text-ink-muted w-16">space-{size}</span>
                <div className={`h-8 bg-primary rounded`} style={{ width: `var(--space-${size})` }} />
              </div>
            ))}
          </div>
        </section>

        {/* Border Radius Section */}
        <section className="mb-16">
          <h2 className="mb-6">Border Radius</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RadiusSwatch name="Small" className="rounded-sm" />
            <RadiusSwatch name="Base" className="rounded" />
            <RadiusSwatch name="Medium" className="rounded-md" />
            <RadiusSwatch name="Large" className="rounded-lg" />
            <RadiusSwatch name="XL" className="rounded-xl" />
            <RadiusSwatch name="2XL" className="rounded-2xl" />
            <RadiusSwatch name="Full" className="rounded-full" />
          </div>
        </section>

        {/* Shadows Section */}
        <section className="mb-16">
          <h2 className="mb-6">Shadows</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ShadowSwatch name="XS" className="shadow-xs" />
            <ShadowSwatch name="Small" className="shadow-sm" />
            <ShadowSwatch name="Base" className="shadow" />
            <ShadowSwatch name="Medium" className="shadow-md" />
            <ShadowSwatch name="Large" className="shadow-lg" />
            <ShadowSwatch name="XL" className="shadow-xl" />
          </div>
        </section>

        {/* Focus Ring Demo */}
        <section className="mb-16">
          <h2 className="mb-6">Focus States</h2>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-primary text-white rounded focus-ring">
              Focus me (Tab)
            </button>
            <button className="px-4 py-2 bg-success text-white rounded focus-ring">
              Focus me too
            </button>
            <button className="px-4 py-2 bg-danger text-white rounded focus-ring">
              And me
            </button>
          </div>
        </section>

        {/* Animations Demo */}
        <section className="mb-16">
          <h2 className="mb-6">Animations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-6 bg-surface rounded-lg animate-fade-in">
              <p className="text-center">Fade In</p>
            </div>
            <div className="p-6 bg-surface rounded-lg animate-slide-up">
              <p className="text-center">Slide Up</p>
            </div>
            <div className="p-6 bg-surface rounded-lg animate-slide-down">
              <p className="text-center">Slide Down</p>
            </div>
            <div className="p-6 bg-surface rounded-lg animate-scale-in">
              <p className="text-center">Scale In</p>
            </div>
          </div>
          <p className="text-sm text-ink-muted mt-4">
            Note: Animations respect prefers-reduced-motion setting
          </p>
        </section>
      </div>
    </div>
  )
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-2">
      <div className={`h-24 rounded-lg ${className} flex items-center justify-center font-medium`}>
        {name}
      </div>
    </div>
  )
}

function RadiusSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-2">
      <div className={`h-24 bg-primary ${className}`} />
      <p className="text-sm text-center text-ink-muted">{name}</p>
    </div>
  )
}

function ShadowSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-2">
      <div className={`h-24 bg-surface rounded-lg ${className}`} />
      <p className="text-sm text-center text-ink-muted">{name}</p>
    </div>
  )
}
