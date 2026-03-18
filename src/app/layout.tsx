import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotetakingApp",
  description: "AI-powered study guide synthesis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
