import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car-Master | 차량 시공 거래를 하나의 흐름으로",
  description: "가격 확인부터 시공점 선택, 거래방, 채팅과 결제까지 연결하는 딜러용 차량 시공 업무 플랫폼입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
