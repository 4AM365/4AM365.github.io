import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "FAMES",
    pageTitleSuffix: " — Four AM Engineering Service",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "4am365.github.io",
    ignorePatterns: ["private", "templates", ".obsidian", "**/images"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "JetBrains Mono",
        body: "IBM Plex Sans",
        code: "JetBrains Mono",
      },
      colors: {
        // Default (JDM white/purple). Overridden per vibe in custom.scss.
        lightMode: {
          light: "#ffffff",
          lightgray: "#ece9f5",
          gray: "#8b86a5",
          darkgray: "#2a2640",
          dark: "#1a1730",
          secondary: "#6d28d9",
          tertiary: "#a78bfa",
          highlight: "rgba(109, 40, 217, 0.08)",
          textHighlight: "#e9d5ff88",
        },
        darkMode: {
          light: "#14101e",
          lightgray: "#26213a",
          gray: "#6e6986",
          darkgray: "#dcd8ec",
          dark: "#f5f3fc",
          secondary: "#a78bfa",
          tertiary: "#c084fc",
          highlight: "rgba(167, 139, 250, 0.10)",
          textHighlight: "#d8b4fe44",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
