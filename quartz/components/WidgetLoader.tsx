// @ts-ignore
import widgetsScript from "./scripts/widgets.inline"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

// Renders nothing; carries the client-side script that mounts [data-widget]
// tool widgets. Add to sharedPageComponents.afterBody so it's on every page.
const WidgetLoader: QuartzComponent = () => null

WidgetLoader.afterDOMLoaded = widgetsScript

export default (() => WidgetLoader) satisfies QuartzComponentConstructor
