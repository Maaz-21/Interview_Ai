import {Mona_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ai-interview",
  description: "Practise interview questions and answers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className='dark'>
      <body
        className={`${monaSans.className} antialiased pattern`}
      >
        {children}
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  );
}
