import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hamburg Ghana SDA Church Management System",
  description: "Church management portal for Hamburg Ghana SDA Church in Hamburg, Germany.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
