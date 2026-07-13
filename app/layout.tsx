import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car-Master | 딜러용 전국 시공점 검색",
  description: "리스·렌트 에이전시 딜러가 고객 차량 인도 지역 주변의 승인 시공점을 찾고 시공 요청을 보내는 B2B 자동차 플랫폼입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
