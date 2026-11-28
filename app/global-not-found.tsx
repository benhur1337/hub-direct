import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Page not found · ไม่พบหน้านี้ — Hub Connect" };

// Unmatched addresses have no locale yet, so this page speaks both languages.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main className="loading not-found">
          <h1>Page not found</h1>
          <p>
            This address doesn’t exist. <Link href="/">Open Hub Connect</Link>
          </p>
          <h1 lang="th">ไม่พบหน้านี้</h1>
          <p lang="th">
            ไม่มีหน้านี้อยู่ <Link href="/th">เปิด Hub Connect</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
