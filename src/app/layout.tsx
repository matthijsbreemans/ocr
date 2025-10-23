import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OCR API Service',
  description: 'Queue-based OCR API for document processing',
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
