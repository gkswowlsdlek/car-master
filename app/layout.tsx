import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car-Master | 자동차 시공 B2B 플랫폼",
  description: "리스·렌트 딜러와 고객 지역의 자동차 시공점을 연결하는 B2B 플랫폼 프로토타입",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
