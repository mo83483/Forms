import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Form Solver — حل نماذج Google Forms بالذكاء الاصطناعي",
  description:
    "سجّل الدخول بحساب Google، الصق رابط النموذج التدريبي، وسيقرأ AI Core الأسئلة ويحلّها ويملأها في النموذج الحقيقي — مع الحفاظ على ميزة Autosave، دون قاعدة بيانات ودون الضغط على Submit نيابةً عنك.",
  applicationName: "AI Form Solver",
  keywords: ["Google Forms", "AI", "ذكاء اصطناعي", "OAuth", "Playwright", "Gemini", "APInex", "GPT-6 Luna", "نماذج تدريبية"],
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}
