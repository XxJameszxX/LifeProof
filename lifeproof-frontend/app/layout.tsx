import "./globals.css";
import Link from "next/link";
import { Providers } from "../providers";

export const metadata = {
  title: "LifeProof – 生活事件上链档案",
  description: "Life events on-chain diary with FHEVM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <header className="w-full sticky top-0 z-50 backdrop-blur bg-white/50 border-b border-white/30">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
              <Link href="/" className="text-lg font-bold text-gradient">LifeProof</Link>
              <nav className="flex items-center gap-3 text-sm text-gray-700">
                <Link href="/feed" className="btn-secondary px-3 py-1">广场</Link>
                <Link href="/" className="btn-secondary px-3 py-1">我的</Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}


