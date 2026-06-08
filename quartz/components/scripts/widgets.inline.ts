// Mounts interactive tool widgets. For every <div data-widget="<name>"> on the
// page, dynamically imports /static/widgets/<name>.js and calls its mount(el).
// Runs on Quartz's "nav" event so it works on first load AND after SPA
// navigation (enableSPA), and is idempotent via the data-mounted flag.

async function mountWidgets() {
  const nodes = document.querySelectorAll<HTMLElement>("[data-widget]")
  for (const el of nodes) {
    if (el.dataset.mounted === "true") continue
    const name = el.dataset.widget
    if (!name) continue
    // Built as a runtime string so esbuild leaves it as a real dynamic import.
    const url = `/static/widgets/${name}.js`
    try {
      const mod = await import(url)
      el.dataset.mounted = "true"
      mod.mount(el)
    } catch (e) {
      console.error(`[widgets] failed to load "${name}" from ${url}`, e)
    }
  }
}

document.addEventListener("nav", () => {
  mountWidgets()
})
