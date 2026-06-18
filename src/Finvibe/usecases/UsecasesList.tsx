import { useEffect, useMemo, useState } from "react";
import type { CodeFile } from "../type/file";
import type { ThemeMode } from "../hooks/useTheme";
import { fetchUsecases } from "../hooks/usecaseApi";
import { fetchFileContent } from "../hooks/driveApi";
import { loadProjectStructure } from "../services/autoLoadFiles";
import { ThemeToggleButton } from "../components/ThemeToggleButton";
import ProjectPreview from "../components/ProjectPreview";

interface UsecasesListProps {
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

const ACCENTS = [
  { accent: "#6366f1", light: "#eef2ff", dark: "#1e1b4b" },
  { accent: "#0ea5e9", light: "#e0f2fe", dark: "#082f49" },
  { accent: "#10b981", light: "#d1fae5", dark: "#064e3b" },
  { accent: "#8b5cf6", light: "#ede9fe", dark: "#2e1065" },
  { accent: "#f59e0b", light: "#fef3c7", dark: "#451a03" },
  { accent: "#ec4899", light: "#fce7f3", dark: "#500724" },
  { accent: "#14b8a6", light: "#ccfbf1", dark: "#042f2e" },
  { accent: "#f43f5e", light: "#ffe4e6", dark: "#4c0519" },
  { accent: "#22c55e", light: "#dcfce7", dark: "#052e16" },
];

const UC_LABELS: Record<string, string> = {
  UC001: "Core Banking",
  UC002: "Payments",
  UC003: "Lending",
  UC005: "Insurance",
  UC017: "Wealth Mgmt",
  UC026: "Compliance",
};

const ucColorCache: Record<string, (typeof ACCENTS)[0]> = {};

function getAccent(id: string, index: number) {
  if (!ucColorCache[id]) ucColorCache[id] = ACCENTS[index % ACCENTS.length];
  return ucColorCache[id];
}

function tokens(theme: ThemeMode) {
  const dark = theme === "dark";
  return {
    pageBg: dark ? "#0d1117" : "#f6f8fb",
    headerBg: dark ? "rgba(22,27,34,0.96)" : "rgba(255,255,255,0.96)",
    headerBorder: dark ? "#21262d" : "#e2e8f0",
    panelBg: dark ? "#161b22" : "#ffffff",
    panelSoft: dark ? "#111827" : "#f8fafc",
    cardBg: dark ? "#161b22" : "#ffffff",
    cardBorder: dark ? "#252c36" : "#e2e8f0",
    cardShadow: dark ? "0 14px 36px rgba(0,0,0,0.25)" : "0 14px 34px rgba(15,23,42,0.08)",
    titleColor: dark ? "#f0f6fc" : "#0f172a",
    subColor: dark ? "#9aa4b2" : "#64748b",
    mutedColor: dark ? "#6e7681" : "#94a3b8",
    divider: dark ? "#252c36" : "#e2e8f0",
    tabActiveBg: dark ? "#1f2937" : "#eef2ff",
    searchBg: dark ? "#0f1720" : "#ffffff",
    searchBorder: dark ? "#30363d" : "#dbe4ef",
    searchColor: dark ? "#f0f6fc" : "#0f172a",
    pillBg: dark ? "#101720" : "#f8fafc",
    pillBorder: dark ? "#30363d" : "#dbe4ef",
  };
}

function splitUsecaseName(name: string) {
  const parts = name.split("-");
  const ucCode = parts[parts.length - 1]?.toUpperCase() || "";
  const bankName = parts.slice(0, -1).join(" ") || name;
  return { bankName, ucCode };
}

function isFolderNode(file: CodeFile) {
  return file.hasChildren === true || file.type === "folder" || file.mimeType === "folder";
}

function collectAllFiles(files: CodeFile[]): CodeFile[] {
  const allFiles: CodeFile[] = [];

  files.forEach((file) => {
    const isFolder = isFolderNode(file) || (Array.isArray(file.children) && file.children.length > 0);

    if (isFolder && Array.isArray(file.children)) {
      allFiles.push(...collectAllFiles(file.children));
    } else if (!isFolder) {
      allFiles.push(file);
    }
  });

  return allFiles;
}

function LoadingPreview() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--app-bg)" }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[var(--panel-border)] border-t-[var(--accent-primary)] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[var(--muted-text)] text-xs">Loading Preview...</p>
      </div>
    </div>
  );
}

export default function UsecasesList({ theme = "light", onToggleTheme = () => {} }: UsecasesListProps) {
  const [usecases, setUsecases] = useState<CodeFile[]>([]);
  const [loadingUsecases, setLoadingUsecases] = useState(true);
  const [loadingUsecaseId, setLoadingUsecaseId] = useState<string | null>(null);
  const [selectedUsecase, setSelectedUsecase] = useState<CodeFile | null>(null);
  const [tree, setTree] = useState<CodeFile[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [fileCache, setFileCache] = useState<Map<string, string>>(new Map());
  const [openFiles, setOpenFiles] = useState<CodeFile[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const t = tokens(theme);

  useEffect(() => {
    loadUsecases();
  }, []);

  async function loadUsecases() {
    setLoadingUsecases(true);
    try {
      const data = await fetchUsecases();
      setUsecases(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsecases(false);
    }
  }

  async function handleUsecaseClick(usecase: CodeFile) {
    setSelectedUsecase(usecase);
    setLoadingUsecaseId(usecase.id);
    setLoadingTree(true);
    setTree([]);
    setSelectedFile(null);
    setFileCache(new Map());
    setShowPreview(true);

    try {
      const { tree: loadedTree, fileCache: loadedCache } = await loadProjectStructure(usecase.id, (updatedTree) => {
        setTree(updatedTree);
      });
      setTree(loadedTree);
      setFileCache(loadedCache);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTree(false);
      setLoadingUsecaseId(null);
    }
  }

  async function handleFileClick(file: CodeFile) {
    if (!openFiles.find((f) => f.id === file.id)) setOpenFiles((p) => [...p, file]);
    setSelectedFile(file);
    setShowCode(true);

    if (fileCache.get(file.id)) return;

    try {
      const content = await fetchFileContent(file.id);
      setFileCache((p) => new Map(p).set(file.id, content));
    } catch (e) {
      console.error(e);
    }
  }

  const banks = useMemo(() => {
    const bankNames = new Set(usecases.map((u) => splitUsecaseName(u.name).bankName));
    return ["All", ...Array.from(bankNames)];
  }, [usecases]);

  const filteredUsecases = useMemo(() => {
    return usecases.filter((u) => {
      const bank = splitUsecaseName(u.name).bankName;
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch && (activeFilter === "All" || bank.toLowerCase() === activeFilter.toLowerCase());
    });
  }, [usecases, searchQuery, activeFilter]);

  if (selectedUsecase) {
    const fileCount = collectAllFiles(tree).length;

    return (
      <div className="flex h-screen" style={{ backgroundColor: "var(--app-bg)", color: "var(--app-text)", fontFamily: "'Sora',sans-serif" }}>
        <div className="bg-[var(--panel-bg)] border-r border-[var(--panel-border)] flex flex-col" style={{ width: "280px" }}>
          <div className="px-4 py-3 border-b border-[var(--panel-border)]" style={{ background: "var(--accent-muted-bg)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,var(--accent-primary),#7c3aed)" }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 style={{ fontFamily: "'Orbitron',monospace", fontWeight: 800, fontSize: "0.85rem", background: "linear-gradient(90deg,var(--accent-primary),#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  USECASES
                </h1>
                <p className="text-[var(--muted-text)] text-[10px] font-medium mt-0.5 truncate">{selectedUsecase.name}</p>
              </div>
            </div>
          </div>

          <div className="p-2 border-b border-[var(--panel-border)]" style={{ background: "var(--overlay-bg-strong)" }}>
            <button
              onClick={() => {
                setSelectedUsecase(null);
                setTree([]);
                setSelectedFile(null);
                setOpenFiles([]);
                setShowCode(false);
                setShowPreview(true);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-[var(--subtle-text)] hover:bg-[var(--panel-border)] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Usecases
            </button>
          </div>

          <div className="px-2 py-2 border-b border-[var(--panel-border)] flex gap-1.5" style={{ background: "var(--overlay-bg-soft)" }}>
            <button
              onClick={() => setShowCode((v) => !v)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all"
              style={{
                background: showCode ? "var(--accent-soft)" : "var(--surface-soft)",
                border: `1px solid ${showCode ? "var(--accent-border-strong)" : "var(--surface-soft-border-2)"}`,
                color: showCode ? "var(--accent-primary)" : "var(--muted-text)",
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {showCode ? "Hide Code" : "Show Code"}
            </button>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all"
              style={{
                background: showPreview ? "var(--accent-soft)" : "var(--surface-soft)",
                border: `1px solid ${showPreview ? "var(--accent-border-strong)" : "var(--surface-soft-border-2)"}`,
                color: showPreview ? "var(--accent-primary)" : "var(--muted-text)",
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2" style={{ background: "var(--overlay-bg-soft)" }}>
            {loadingTree && tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2.5">
                <div className="w-8 h-8 border-2 border-[var(--panel-border)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
                <p className="text-[var(--muted-text)] font-medium text-[10px]">Loading usecase...</p>
                <p className="text-[var(--accent-primary)] text-[10px] text-center px-3">{selectedUsecase.name}</p>
              </div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="w-10 h-10 bg-[var(--panel-border)] rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--muted-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <p className="text-[var(--muted-text)] text-[10px]">No files found</p>
              </div>
            ) : (
              <>
                <div className="mb-2 px-2 py-1 rounded text-[9px] font-semibold" style={{ background: "var(--accent-faint)", color: "var(--accent-primary)", border: "1px solid var(--accent-border-soft)" }}>
                  {fileCount} files in usecase
                </div>
                <FileTreeView files={tree} selectedFile={selectedFile} onFileClick={handleFileClick} />
              </>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {showPreview && (
            !loadingTree && tree.length > 0 ? (
              <ProjectPreview
                projectTitle={selectedUsecase.name}
                tree={tree}
                fileCache={fileCache}
                onClose={() => setShowPreview(false)}
                onTogglePreview={() => setShowPreview((v) => !v)}
                showCode={showCode}
                onToggleCode={() => setShowCode((v) => !v)}
                theme={theme}
                onToggleTheme={onToggleTheme}
              />
            ) : (
              <LoadingPreview />
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.titleColor, fontFamily: "'Sora', sans-serif" }}>
      <header style={{ background: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px 20px", padding: "14px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 22px rgba(37,99,235,0.24)" }}>
                <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Orbitron', monospace", fontWeight: 800, fontSize: "1.05rem", background: "linear-gradient(90deg, #2563eb, #14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.04em" }}>
                  OXY BFSI
                </div>
                <div style={{ fontSize: "0.6rem", color: t.mutedColor, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase", marginTop: "1px" }}>
                  Use Case Repository
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {[
                { label: "Total", value: usecases.length, color: "#6366f1" },
                { label: "Banks", value: banks.length - 1, color: "#0ea5e9" },
                { label: "Shown", value: filteredUsecases.length, color: "#10b981" },
              ].map((p) => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "8px", background: t.pillBg, border: `1px solid ${t.pillBorder}` }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: p.color, fontFamily: "'Orbitron', monospace", lineHeight: 1 }}>{p.value}</span>
                  <span style={{ fontSize: "0.6rem", color: t.subColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{p.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 260, flex: "1 1 300px", maxWidth: "380px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: t.subColor, flexShrink: 0 }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search usecases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", paddingLeft: "34px", paddingRight: "14px", paddingTop: "8px", paddingBottom: "8px", borderRadius: "8px", fontSize: "0.78rem", border: `1.5px solid ${t.searchBorder}`, background: t.searchBg, color: t.searchColor, outline: "none", fontFamily: "'Sora', sans-serif" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = t.searchBorder)}
                />
              </div>
              <ThemeToggleButton theme={theme} onToggleTheme={onToggleTheme} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "2px", overflowX: "auto", scrollbarWidth: "none", marginBottom: "-1px" }}>
            {banks.slice(0, 9).map((bank) => {
              const active = activeFilter === bank;
              return (
                <button
                  key={bank}
                  onClick={() => setActiveFilter(bank)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: active ? t.tabActiveBg : "transparent",
                    color: active ? "#2563eb" : t.subColor,
                    border: "none",
                    borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                    cursor: "pointer",
                    borderRadius: "6px 6px 0 0",
                    textTransform: "capitalize",
                    transition: "color 0.15s, background 0.15s",
                    fontFamily: "'Sora', sans-serif",
                  }}
                >
                  {bank === "All" ? "All Usecases" : bank.replace(/-/g, " ")}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 24px" }}>
        {loadingUsecases ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} style={{ height: "168px", borderRadius: "8px", background: t.cardBg, border: `1px solid ${t.cardBorder}`, padding: "16px", overflow: "hidden" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: t.pillBg, marginBottom: "18px" }} />
                <div style={{ width: "70%", height: "12px", borderRadius: "999px", background: t.pillBg, marginBottom: "10px" }} />
                <div style={{ width: "46%", height: "10px", borderRadius: "999px", background: t.pillBg }} />
              </div>
            ))}
          </div>
        ) : filteredUsecases.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "320px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: t.pillBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                <svg width="22" height="22" fill="none" stroke={t.subColor} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p style={{ color: t.subColor, fontSize: "0.82rem" }}>No usecases found</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {filteredUsecases.map((usecase, index) => {
              const { bankName, ucCode } = splitUsecaseName(usecase.name);
              const a = getAccent(usecase.id, index);
              const label = UC_LABELS[ucCode] || "Use Case";
              const iconBg = theme === "dark" ? a.dark : a.light;
              const isLoading = loadingUsecaseId === usecase.id;

              return (
                <div key={usecase.id} style={{ cursor: "pointer" }} onClick={() => !isLoading && handleUsecaseClick(usecase)}>
                  <div
                    style={{
                      background: t.cardBg,
                      border: `1px solid ${t.cardBorder}`,
                      borderRadius: "8px",
                      overflow: "hidden",
                      boxShadow: t.cardShadow,
                      minHeight: "180px",
                      transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
                      opacity: isLoading ? 0.72 : 1,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = "translateY(-3px)";
                      el.style.borderColor = a.accent;
                      el.style.boxShadow = `0 0 0 1px ${a.accent}50, 0 8px 24px ${a.accent}25`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = "";
                      el.style.borderColor = t.cardBorder;
                      el.style.boxShadow = t.cardShadow;
                    }}
                  >
                    <div style={{ height: "3px", background: `linear-gradient(90deg, ${a.accent}cc, ${a.accent}44)` }} />

                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" fill="none" stroke={a.accent} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "monospace", padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.06em", background: iconBg, color: a.accent, border: `1px solid ${a.accent}40` }}>
                          {ucCode}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.98rem", fontWeight: 800, color: t.titleColor, lineHeight: 1.35, marginBottom: "4px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {bankName}
                      </div>

                      <div style={{ fontSize: "0.74rem", color: t.subColor, fontWeight: 600, marginBottom: "14px" }}>
                        {label}
                      </div>

                      <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.68rem", color: t.mutedColor, fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                          {usecase.hasChildren ? "Multi-file" : "Single file"}
                        </span>
                        {isLoading ? (
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: a.accent, display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", border: `2px solid ${a.accent}40`, borderTopColor: a.accent, display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                            Loading
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: a.accent, display: "flex", alignItems: "center", gap: "4px" }}>
                            Open
                            <svg width="12" height="12" fill="none" stroke={a.accent} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loadingUsecases && filteredUsecases.length > 0 && (
          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.7rem", color: t.mutedColor }}>
            Showing {filteredUsecases.length} of {usecases.length} usecases
          </p>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface FileTreeViewProps {
  files: CodeFile[];
  selectedFile: CodeFile | null;
  onFileClick: (file: CodeFile) => void;
  level?: number;
}

function FileTreeView({ files, selectedFile, onFileClick, level = 0 }: FileTreeViewProps) {
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <TreeNode
          key={file.id}
          node={file}
          selectedFile={selectedFile}
          onFileClick={onFileClick}
          level={level}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selectedFile,
  onFileClick,
  level,
}: {
  node: CodeFile;
  selectedFile: CodeFile | null;
  onFileClick: (file: CodeFile) => void;
  level: number;
}) {
  const isFolder =
    node.hasChildren === true ||
    (Array.isArray(node.children) && node.children.length > 0) ||
    node.mimeType === "folder" ||
    node.type === "folder";
  const [expanded, setExpanded] = useState(level === 0 && isFolder);
  const isSelected = selectedFile?.id === node.id;
  const isLoading = node.isLoading;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors ${
          isSelected ? "bg-[var(--panel-border)] text-[var(--primary-text)]" : "hover:bg-[var(--panel-border)] text-[var(--subtle-text)]"
        }`}
        style={{ paddingLeft: `${level * 10 + 8}px` }}
        onClick={() => (isFolder ? setExpanded((value) => !value) : onFileClick(node))}
      >
        {isFolder &&
          (isLoading ? (
            <div className="w-2.5 h-2.5 border border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className={`w-2.5 h-2.5 transition-transform text-[var(--muted-text)] ${
                expanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ))}
        <span className="text-sm flex-shrink-0">
          {isFolder ? (
            expanded ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent-primary)" fillOpacity=".7" stroke="var(--accent-primary)" strokeWidth="1.5">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--muted-text)" fillOpacity=".7" stroke="var(--muted-text)" strokeWidth="1.5">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            )
          ) : (
            getFileIcon(node.name)
          )}
        </span>
        <span className="flex-1 text-xs font-normal truncate">{node.name}</span>
        {!isFolder && (
          <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}>
            {getFileExtension(node.name)}
          </span>
        )}
        {isLoading && <span className="text-[9px] text-[var(--accent-primary)]">Loading...</span>}
      </div>

      {isFolder && expanded && Array.isArray(node.children) && node.children.length > 0 && (
        <FileTreeView
          files={node.children}
          selectedFile={selectedFile}
          onFileClick={onFileClick}
          level={level + 1}
        />
      )}
    </div>
  );
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const color: Record<string, string> = {
    js: "#f7df1e",
    jsx: "#61dafb",
    ts: "#3178c6",
    tsx: "#61dafb",
    java: "#f89820",
    py: "#3572A5",
    html: "#e34c26",
    css: "#563d7c",
    json: "var(--subtle-text)",
    md: "var(--muted-text)",
    xml: "var(--subtle-text)",
    yml: "var(--subtle-text)",
    yaml: "var(--subtle-text)",
    sql: "#336791",
    sh: "#89e051",
    bash: "#89e051",
  };
  const iconColor = color[ext || ""] || "var(--muted-text)";

  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}
