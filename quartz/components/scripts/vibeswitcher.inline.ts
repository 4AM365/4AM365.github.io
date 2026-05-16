const VIBES = ["jdm", "geocities", "coder"] as const
type Vibe = (typeof VIBES)[number]

const savedVibe = (localStorage.getItem("vibe") as Vibe) ?? "jdm"
const initialVibe = (VIBES as readonly string[]).includes(savedVibe) ? savedVibe : "jdm"
document.documentElement.setAttribute("saved-vibe", initialVibe)

document.addEventListener("nav", () => {
  const setVibe = (vibe: Vibe) => {
    document.documentElement.setAttribute("saved-vibe", vibe)
    localStorage.setItem("vibe", vibe)
    document.querySelectorAll(".vibe-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-vibe") === vibe)
    })
  }

  const handleClick = (e: Event) => {
    const target = e.currentTarget as HTMLButtonElement
    const vibe = target.getAttribute("data-vibe") as Vibe | null
    if (!vibe || !(VIBES as readonly string[]).includes(vibe)) return
    setVibe(vibe)
  }

  const current = (document.documentElement.getAttribute("saved-vibe") as Vibe) ?? "jdm"
  document.querySelectorAll(".vibe-btn").forEach((btn) => {
    btn.addEventListener("click", handleClick)
    btn.classList.toggle("active", btn.getAttribute("data-vibe") === current)
    window.addCleanup(() => btn.removeEventListener("click", handleClick))
  })
})
