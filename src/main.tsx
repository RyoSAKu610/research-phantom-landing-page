import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./payments/agent-payments.css";
import "./research/library.css";
import "./guide-pet.css";
import App from "./App";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ResearchPhantom failed to render", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-screen place-items-center bg-ink-900 p-6 text-center text-cream-100">
          <div className="max-w-lg">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-gold-400/40 font-jp text-gold-300">甲</span>
            <h1 className="mt-5 font-display text-3xl">ページを表示できませんでした</h1>
            <p className="mt-3 text-sm leading-relaxed text-sand-300">
              ブラウザを再読み込みしてください。改善しない場合は、最新版のChrome、Safari、Edgeで開いてください。
            </p>
            <button className="btn-gold mt-6 rounded-full px-6 py-3 text-sm font-semibold" onClick={() => window.location.reload()}>
              再読み込みする
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root was not found.");
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
