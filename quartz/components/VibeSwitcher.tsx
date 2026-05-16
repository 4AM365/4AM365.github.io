// @ts-ignore
import vibeSwitcherScript from "./scripts/vibeswitcher.inline"
import styles from "./styles/vibeswitcher.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const VibeSwitcher: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={classNames(displayClass, "vibe-switcher")}>
      <span class="vibe-label">vibe</span>
      <button class="vibe-btn" data-vibe="jdm" aria-label="JDM vibe">jdm</button>
      <button class="vibe-btn" data-vibe="geocities" aria-label="Geocities vibe">geocities</button>
      <button class="vibe-btn" data-vibe="coder" aria-label="Coder vibe">coder</button>
    </div>
  )
}

VibeSwitcher.beforeDOMLoaded = vibeSwitcherScript
VibeSwitcher.css = styles

export default (() => VibeSwitcher) satisfies QuartzComponentConstructor
