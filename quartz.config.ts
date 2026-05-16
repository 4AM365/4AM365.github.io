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
        // Daytime — JDM technical-document feel: cream paper, deep
        // gunmetal text, Skyline red accents.
        lightMode: {
          light: "#f3efe7",
          lightgray: "#d8d2c4",
          gray: "#7a756c",
          darkgray: "#1a1a1a",
          dark: "#050505",
          secondary: "#c8102e",
          tertiary: "#005776",
          highlight: "rgba(200, 16, 46, 0.08)",
          textHighlight: "#ffd60088",
        },
        // Night — JDM dash-at-night: near-black, red turbo timer,
        // cyan gauge backlight.
        darkMode: {
          light: "#0a0a0c",
          lightgray: "#1c1c20",
          gray: "#5a5a60",
          darkgray: "#d8d8dc",
          dark: "#f5f5f7",
          secondary: "#ff2d2d",
          tertiary: "#00d4ff",
          highlight: "rgba(255, 45, 45, 0.10)",
          textHighlight: "#ffd60055",
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
