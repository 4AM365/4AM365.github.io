// @ts-ignore
import vibeSwitcherScript from "./scripts/vibeswitcher.inline"
import styles from "./styles/vibeswitcher.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const VibeSwitcher: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={classNames(displayClass, "vibe-switcher")}>
      <button class="vibe-btn" data-vibe="jdm" type="button" aria-label="JDM vibe">jdm</button>
      <button class="vibe-btn" data-vibe="geocities" type="button" aria-label="Geocities vibe">geocities</button>
      <button class="vibe-btn" data-vibe="coder" type="button" aria-label="Coder vibe">coder</button>
    </div>
  )
}

VibeSwitcher.beforeDOMLoaded = vibeSwitcherScript
VibeSwitcher.css = styles

export default (() => VibeSwitcher) satisfies QuartzComponentConstructor
