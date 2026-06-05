"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { GraduationCap, Search, ChevronDown, ArrowRight, BookOpen, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEARN_ARTICLES, LEARN_CATEGORIES, type LearnCategory, type LearnArticle } from "@/lib/learn/content";

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: LearnArticle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/85">{article.title}</p>
          <p className="text-xs text-white/40 mt-0.5">{article.summary}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-white/25 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/[0.05]">
          {article.body.map((p, i) => (
            <p key={i} className={cn("text-sm leading-relaxed", p.startsWith("•") ? "text-white/55 pl-1" : "text-white/65")}>
              {p}
            </p>
          ))}
          {article.cta && (
            <Link
              href={article.cta.href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors mt-1"
            >
              {article.cta.label} <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [cat,   setCat]   = useState<LearnCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LEARN_ARTICLES.filter((a) => {
      if (cat !== "all" && a.category !== cat) return false;
      if (!q) return true;
      return (a.title + " " + a.summary + " " + a.body.join(" ")).toLowerCase().includes(q);
    });
  }, [cat, query]);

  const tabs: { id: LearnCategory | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...LEARN_CATEGORIES,
  ];

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-[#B48B40]/12 border border-[#B48B40]/25 flex items-center justify-center">
              <GraduationCap className="w-[18px] h-[18px] text-[#B48B40]" strokeWidth={1.5} />
            </div>
            <h1 className="text-[2rem] font-semibold tracking-tight leading-none">Learn</h1>
          </div>
          <p className="text-white/40 text-sm">How to get the most out of FlowState — plus training & nutrition that actually moves the needle.</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics…"
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setCat(t.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border",
                cat === t.id
                  ? "bg-[#B48B40]/12 text-[#B48B40] border-[#B48B40]/25"
                  : "border-white/[0.08] text-white/40 hover:text-white/65 hover:border-white/15",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-10">No topics match &ldquo;{query}&rdquo;.</p>
          ) : (
            filtered.map((a) => <ArticleCard key={a.id} article={a} />)
          )}
        </div>

        {/* Resources */}
        {(cat === "all" || cat === "nutrition") && !query && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">Resources</p>
            <a
              href="/resources/conquer-your-carbs.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] hover:bg-[#B48B40]/[0.07] hover:border-[#B48B40]/28 px-5 py-4 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#B48B40]/70" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80">How to Conquer Your Carbs</p>
                <p className="text-xs text-white/35 mt-0.5">The full ebook — carb strategy & nutrition philosophy.</p>
              </div>
              <Download className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.5} />
            </a>
          </div>
        )}

        {/* Coach tie-in */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white/70">Still have a question?</p>
            <p className="text-xs text-white/35 mt-0.5">Your AI coach can explain any of this for your situation.</p>
          </div>
          <Link
            href="/coach"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 px-3.5 py-2 text-xs font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 transition-all"
          >
            Ask the coach <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>

      </div>
    </div>
  );
}
