import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./context/I18nContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { ProProvider } from "./context/ProContext";
import { LibraryProvider } from "./context/LibraryContext";
import { ToastProvider } from "./context/ToastContext";
import { GatingProvider } from "./context/GatingContext";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/topbar.css";
import "./styles/home.css";
import "./styles/cards.css";
import "./styles/shelves.css";
import "./styles/articles.css";
import "./styles/footer.css";
import "./styles/overlays.css";
import "./styles/pages.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProProvider>
            <LibraryProvider>
              <ToastProvider>
                <GatingProvider>
                  <App />
                </GatingProvider>
              </ToastProvider>
            </LibraryProvider>
          </ProProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
);
