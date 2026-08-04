import Topbar from "./Topbar";
import Footer from "./Footer";

export default function StaticLayout({ title, subtitle, children }) {
  return (
    <div className="site-shell">
      <Topbar />
      <main className="page-main page-main-narrow">
        <header className="page-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
        <div className="static-content glass">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
