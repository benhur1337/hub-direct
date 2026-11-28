import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hub Connect — Publishing workspace",
  description: "Plan social posts, review captions, and manage each brand’s publishing schedule in Hub Connect.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint, so dark mode doesn't flash light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
