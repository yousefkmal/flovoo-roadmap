import Link from "next/link";

/**
 * Root-level 404. Every real route lives under `/[locale]`, so this only ever
 * renders for a path the middleware couldn't map — it carries its own <html>.
 */
export default function NotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f5f8fd",
          color: "#0e2045",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>الصفحة غير موجودة</h1>
          <p style={{ color: "#4f5f82", marginBottom: 20 }}>Page not found</p>
          <Link href="/ar" style={{ color: "#4c85ff", fontWeight: 700 }}>
            العودة إلى خارطة الطريق
          </Link>
        </div>
      </body>
    </html>
  );
}
