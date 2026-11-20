import { Figtree, Geist_Mono } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const metadata = {
  title: "better-auth-nuvion example",
  description:
    "Split payments across an organization hierarchy with Better Auth and Nuvion.",
};
// Applies the saved theme before first paint so there is no flash.
const THEME = `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"system";document.documentElement.dataset.accent=localStorage.getItem("accent")||"pink"}catch(e){document.documentElement.dataset.theme="system"}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${mono.variable}`}
      data-theme="system"
      data-accent="pink"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
