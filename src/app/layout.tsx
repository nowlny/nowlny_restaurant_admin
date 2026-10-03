import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

// Outfit has no Arabic glyphs, so Arabic used to fall back to whatever the OS
// had. This face is matched to Outfit's weights and x-height.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  title: "Nowlny Restaurant Admin",
  description: "Manage your restaurant on Nowlny",
};

/**
 * Applies the stored theme and language before first paint.
 *
 * Both used to be decided after hydration — the palette by
 * `prefers-color-scheme`, the direction not at all. Doing either in an effect
 * means a visible flash: a dark-mode operator gets a white screen for a frame,
 * and an Arabic operator watches the entire dashboard lay out left-to-right and
 * then snap. This runs synchronously in <head>, before the browser paints.
 *
 * The keys match `THEME_STORAGE_KEY` / `LOCALE_STORAGE_KEY` in src/lib.
 */
const bootScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("nowlny_theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
  try {
    var locale = window.localStorage.getItem("nowlny_locale");
    if (locale === "ar" || locale === "en") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${outfit.variable} ${plexArabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
