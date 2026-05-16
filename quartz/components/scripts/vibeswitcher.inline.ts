const VIBES = ["jdm", "geocities", "coder"]
const DEFAULT_VIBE = "jdm"

const readVibe = (): string => {
  try {
    const stored = localStorage.getItem("vibe")
    if (stored && VIBES.includes(stored)) return stored
  } catch {}
  return DEFAULT_VIBE
}

const applyActiveState = () => {
  const current = document.documentElement.getAttribute("saved-vibe") ?? DEFAULT_VIBE
  document.querySelectorAll(".vibe-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-vibe") === current)
  })
}

const setVibe = (vibe: string) => {
  if (!VIBES.includes(vibe)) return
  document.documentElement.setAttribute("saved-vibe", vibe)
  try {
    localStorage.setItem("vibe", vibe)
  } catch {}
  applyActiveState()
}

// Apply initial vibe immediately so first paint matches preference.
document.documentElement.setAttribute("saved-vibe", readVibe())

// Document-level event delegation. Survives SPA navigation. Attaches
// once via a window flag, so we never double-bind.
const w = window as unknown as { __famesVibeBound?: boolean }
if (!w.__famesVibeBound) {
  document.addEventListener("click", (e) => {
    const target = (e.target as Element | null)?.closest?.(".vibe-btn") as HTMLElement | null
    if (!target) return
    const vibe = target.getAttribute("data-vibe")
    if (vibe) setVibe(vibe)
  })
  w.__famesVibeBound = true
}

// Re-apply active state after each Quartz nav event (handles SPA transitions
// where the DOM may have been replaced but our vibe attribute persists).
document.addEventListener("nav", () => {
  applyActiveState()
})
