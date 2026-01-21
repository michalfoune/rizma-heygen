import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rizma.ai - AI Interview Simulation',
  description: 'Practice job interviews with an AI-powered interactive avatar',
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
