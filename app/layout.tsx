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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
