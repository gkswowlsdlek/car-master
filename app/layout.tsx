import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car-Master | 가까운 시공점을 가장 빠르게",
  description: "전국 어디로 출고해도 가까운 시공점을 바로 찾고, 견적 요청부터 거래·채팅까지 한 곳에서 연결하는 딜러용 차량 시공 업무 플랫폼입니다.",
};

// iOS Safari's default (resizes-visual) keeps 100dvh layouts pinned to their
// pre-keyboard height, so the on-screen keyboard just overlays them; the
// browser then falls back to scrolling the whole page to keep the focused
// input visible, dragging fixed headers off-screen. resizes-content makes
// the keyboard actually shrink the layout viewport (and dvh with it), so the
// existing dvh-based Messenger layout reflows correctly instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
