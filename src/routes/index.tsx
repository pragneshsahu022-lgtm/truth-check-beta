import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: TruthCheck,
  head: () => ({
    meta: [
      { title: "TruthCheck — Fake News Stress Tester" },
      { name: "description", content: "AI-powered fake news stress tester. Paste any headline and get a risk score across 5 credibility dimensions, powered by Gemma 4." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" },
    ],
  }),
});

const DIMENSIONS = [
  { key: "sensationalism", name: "Sensationalism", desc: "Emotional, clickbait, hyperbolic language" },
  { key: "source_credibility", name: "Source Credibility", desc: "Named sources, citations, verifiability" },
  { key: "factual_consistency", name: "Factual Consistency", desc: "Internal logic and claim plausibility" },
  { key: "bias_loaded_language", name: "Bias & Loaded Language", desc: "Slanted framing or propaganda cues" },
  { key: "manipulation_tactics", name: "Manipulation Tactics", desc: "Fear, outrage, urgency, conspiracy hooks" },
] as const;

type DimKey = typeof DIMENSIONS[number]["key"];

type Analysis = {
  risk_score: number;
  verdict: string;
  tags: string[];
  dimensions: Record<DimKey, number>;
  red_flags: string[];
};

const MAX = 5000;

function bucket(n: number): "low" | "mid" | "high" {
  if (n >= 70) return "high";
  if (n >= 40) return "mid";
  return "low";
}

function riskLabel(n: number) {
  const b = bucket(n);
  return b === "high" ? "High Risk" : b === "mid" ? "Medium Risk" : "Low Risk";
}

async function analyze(text: string): Promise<Analysis> {
  const apiKey = import.meta.env.VITE_GEMMA_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMMA_API_KEY");

  const prompt = `You are TruthCheck, a fake news stress tester. Analyze the following text and return ONLY valid JSON (no markdown, no code fences) with this exact shape:

{
  "risk_score": <integer 0-100, overall likelihood the text is misleading/fake>,
  "verdict": "<2-3 sentence plain-language judgement>",
  "tags": ["<short tag>", "<short tag>"],
  "dimensions": {
    "sensationalism": <0-100>,
    "source_credibility": <0-100, higher = MORE suspicious / LESS credible sources>,
    "factual_consistency": <0-100, higher = MORE inconsistent>,
    "bias_loaded_language": <0-100>,
    "manipulation_tactics": <0-100>
  },
  "red_flags": ["<specific concrete red flag>", "..."]
}

Text to analyze:
"""${text}"""`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemma API error (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  let parsed: Analysis;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Could not parse model response.");
    parsed = JSON.parse(m[0]);
  }
  return parsed;
}

function TruthCheck() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await analyze(text.slice(0, MAX));
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const scoreBucket = result ? bucket(result.risk_score) : "low";

  return (
    <>
      <nav>
        <a className="nav-brand" href="/">
          <div className="nav-logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
            </svg>
          </div>
          <span className="nav-name">TruthCheck</span>
          <span className="nav-pill">Beta</span>
        </a>
        <div className="nav-right">
          <span className="nav-tag">gemma-4-26b-a4b-it</span>
        </div>
      </nav>

      <main className="page">
        <header className="page-header">
          <div className="header-eyebrow">
            <span className="dot-live" />
            Powered by Gemma 4 · Google AI Studio
          </div>
          <h1 className="page-title">
            Is this news <em>real?</em>
          </h1>
          <p className="page-sub">
            Paste any headline or article. AI stress-tests it across 5 credibility dimensions and returns a risk score in seconds.
          </p>
        </header>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Input</span>
            <span className="card-hint">Headline or Article Text</span>
          </div>
          <div className="card-body">
            <textarea
              placeholder="Try any news headline — real or suspicious"
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="char-row">
              <span className="char-count">{text.length} / {MAX}</span>
            </div>
            {error && <div className="error-box">{error}</div>}
            <div className="btn-row">
              <button className="btn-primary" onClick={run} disabled={loading || !text.trim()}>
                {loading && <span className="spinner" />}
                {loading ? "Analyzing…" : "Run Stress Test"}
              </button>
            </div>
          </div>
        </section>

        {result && (
          <>
            <div className="section-label">Analysis Results</div>
            <section className="card">
              <div className="verdict-row">
                <div className={`score-panel ${scoreBucket}`}>
                  <div className={`score-big ${scoreBucket}`}>{result.risk_score}</div>
                  <div className="score-label" style={{ color: "var(--text-muted)" }}>Risk Score</div>
                  <span className={`risk-badge ${scoreBucket}`}>{riskLabel(result.risk_score)}</span>
                </div>
                <div className="verdict-panel">
                  <div className="verdict-eyebrow">AI Verdict</div>
                  <div className="verdict-text">{result.verdict}</div>
                  {result.tags?.length > 0 && (
                    <div className="tags-row">
                      {result.tags.map((t) => (
                        <span key={t} className="nav-tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {DIMENSIONS.map((d) => {
                const v = Math.max(0, Math.min(100, Number(result.dimensions?.[d.key] ?? 0)));
                const b = bucket(v);
                return (
                  <div key={d.key} className="dimension-row">
                    <div>
                      <div className="dim-name">{d.name}</div>
                      <div className="dim-desc">{d.desc}</div>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${b}`} style={{ width: `${v}%` }} />
                    </div>
                    <div className={`dim-score ${b}`}>{v}</div>
                  </div>
                );
              })}

              <div className="legend-row">
                <span className="legend-label">Score guide:</span>
                <div className="legend-items">
                  <span className="legend-item"><span className="legend-dot low" />0–39 Low</span>
                  <span className="legend-item"><span className="legend-dot mid" />40–69 Medium</span>
                  <span className="legend-item"><span className="legend-dot high" />70–100 High</span>
                </div>
              </div>

              {result.red_flags?.length > 0 && (
                <div className="flags-section">
                  <div className="flags-title">Red Flags Detected</div>
                  <div className="flags-list">
                    {result.red_flags.map((f, i) => (
                      <div key={i} className="flag-item">
                        <span className="flag-bullet">●</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <div className="section-label">How It Works</div>
        <section className="card">
          <div className="how-grid">
            <div className="how-item">
              <div className="how-number">01</div>
              <div className="how-heading">Paste your text</div>
              <div className="how-desc">Any headline, tweet, or article excerpt up to 5,000 characters.</div>
            </div>
            <div className="how-item">
              <div className="how-number">02</div>
              <div className="how-heading">Gemma 4 analyzes it</div>
              <div className="how-desc">Google's latest open model stress-tests it across 5 credibility dimensions.</div>
            </div>
            <div className="how-item">
              <div className="how-number">03</div>
              <div className="how-heading">Get your risk report</div>
              <div className="how-desc">A 0–100 risk score, dimension breakdown, and specific red flags.</div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
