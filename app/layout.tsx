import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Home Decision Dashboard",
  description: "A Zillow-like decision dashboard prototype for comparing shortlisted homes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
