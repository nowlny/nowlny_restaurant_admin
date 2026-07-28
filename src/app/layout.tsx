import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
});

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
      className={outfit.variable}
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
