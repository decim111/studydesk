import { useState, useRef, useEffect } from "react";

const COLORS = [
  "#6C63FF","#FF6584","#43B89C","#F7B731","#4A90E2",
  "#E17055","#A29BFE","#00CEC9","#FD79A8","#55EFC4"
];

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

function generateId() { return Math.random().toString(36).slice(2,9); }

function buildNoteAmeliorationPrompt(f) {
  return `You are an expert academic editor and subject-matter specialist in the field covered by the notes below. Your task is to take raw, unstructured notes and transform them into a clean, well-organized academic text — without inventing content, but without leaving any concept under-explained. Where expansion is necessary, draw only on established knowledge in this field; flag anything that would require external sourcing.

YOUR TASK IN ONE SENTENCE
Reorganize, format, verify, and clarify — in that order of priority.

WHAT YOU MUST DO

Step 1 — Read and Diagnose (show this before doing anything else)
Before touching the text, produce a short diagnostic report covering:
• The main topics present and the order they currently appear in
• Structural problems: repetitions, misplaced information, abrupt jumps
• Clarity problems: concepts stated but not explained, terms used without definition, ambiguous or incomplete sentences
• Factual concerns: anything imprecise, outdated, or potentially wrong — flag these explicitly with ⚠️ before reorganization begins

Step 2 — Propose a Structure
Based on your diagnosis, propose a clean paragraph and section hierarchy. The structure must:
• Follow a logical sequence where each idea prepares the ground for the next
• Group related concepts that are currently scattered
• Separate distinct ideas that are currently merged
State briefly why you chose this structure.
${f.pauseAfterStep2 === "yes" ? "Then PAUSE and wait for user approval before proceeding to Step 3." : "Then proceed immediately to Step 3 without waiting."}

Step 3 — Reorganize and Rewrite

Formatting
• Divide the text into clearly titled sections and, where needed, subsections
• Each paragraph must contain one central idea
• Paragraphs must be coherent units: opening sentence states the point, body sentences develop it, closing sentence consolidates or transitions
• Use continuous prose as the default; use bullet points only for genuine lists (enumerations, legal provisions, sequential steps) — never as a substitute for explanation

Clarity
• Every technical term must be defined on first use
• Every concept merely named or listed in the original must receive at minimum a clear one-sentence explanation
• Ambiguous pronouns, incomplete sentences, and unclear references must be resolved using the most accurate interpretation of the original
• Do not simplify in a way that removes nuance; do not elaborate in a way that adds scope

Verification and Correction
• Imprecise or incorrect statement → correct and mark: [CORRECTED: original said X, accurate version is Y, reason: ...]
• Incomplete statement that can be safely completed → complete and mark: [EXPANDED: original was incomplete, added: ...]
• Too vague to correct safely → flag and leave: [FLAG: this claim is unclear — verify before use]
• Never silently alter a factual claim; every intervention must be visible

Fidelity
• Do not add topics, arguments, or concepts not present in the original
• Do not remove any point present in the original, even if brief or seemingly minor
• Do not change the position or interpretation of any claim
• The original is the map; you are clarifying the territory it describes

Step 4 — End Summary
After the reorganized text, provide a summary (scaled to note length) covering:
• What structural changes you made and why
• Which concepts you expanded and to what extent
• All corrections and flags, listed together for easy review
• Anything the author should double-check or research further

OUTPUT LANGUAGE: ${f.language || "same as the input notes"}
DESIRED STRUCTURE: ${f.structure || "infer the best structure from the content"}
LEVEL OF DETAIL: ${f.detail || "preserve the original level of detail, expanding only where clarity demands"}
FOCUS AREAS: ${f.focus || "all topics present in the notes equally"}
${f.supplementary ? `SUPPLEMENTARY INSTRUCTIONS: ${f.supplementary}` : ""}

INPUT NOTES:
${f.notes}`;
}

function buildSimplificationPrompt(f) {
  return `You are an expert educator specializing in making complex academic concepts accessible without sacrificing accuracy.

CONCEPT OR TEXT TO SIMPLIFY:
${f.concept}

TARGET LEVEL: ${f.level}
EXPLANATION STYLE: ${f.style}
OUTPUT LANGUAGE: ${f.language || "same as input"}

INSTRUCTIONS:
1. Begin with a one-sentence plain-language definition of the core idea.
2. Develop the explanation using the chosen style (${f.style}), building from foundational elements to the full concept.
3. Use concrete, real-world examples to anchor abstract ideas.
4. If the concept has common misconceptions, address them explicitly.
5. End with a one-paragraph synthesis that restates the concept at the target level.
6. Do not oversimplify to the point of inaccuracy. Flag any nuance that cannot be preserved at the target level with: [NOTE: simplified here — full nuance requires deeper study].`;
}

function buildConceptMapPrompt(f) {
  return `You are an expert in knowledge visualization and academic learning design.

TOPIC OR NOTES:
${f.topic}

SUBJECT FIELD: ${f.field || "infer from the topic"}
DEPTH: ${f.depth}
OUTPUT LANGUAGE: ${f.language || "same as input"}

Your task: generate a fully self-contained, interactive HTML concept map for studying this topic.

REQUIREMENTS:
• The HTML must be complete and renderable on its own (inline CSS and JS, no external dependencies except standard browser APIs)
• Nodes represent key concepts; edges represent relationships with labeled arrows
• Clicking a node expands a tooltip or side panel with a concise explanation of that concept
• Color-code nodes by category or cluster
• Include a legend
• Layout must be clean and readable — use a force-directed or hierarchical layout
• The map must be interactive: draggable nodes, zoom/pan, hover highlights
• Do not include concepts not present or clearly implied by the input

Return ONLY the complete HTML code, starting with <!DOCTYPE html>, with no surrounding explanation.`;
}

function buildSummarisationPrompt(f) {
  return `You are an expert academic summariser with deep subject-matter knowledge.

TEXT OR NOTES TO SUMMARISE:
${f.text}

SUMMARY LENGTH: ${f.length}
FORMAT: ${f.format}
KEY FOCUS AREAS: ${f.focus || "all major themes in the text"}
OUTPUT LANGUAGE: ${f.language || "same as input"}

INSTRUCTIONS:
1. Identify and retain all key arguments, findings, and concepts.
2. Eliminate redundancy, examples used purely for illustration, and digressions — unless they are themselves key points.
3. Preserve the logical structure of the original.
4. Do not introduce external information or interpretation not present in the original.
5. Format the output according to the specified format (${f.format}).
6. End with a "Key Takeaways" section of 3–5 bullet points.`;
}

function buildWritingAssistancePrompt(f) {
  return `You are an expert academic writing coach and editor with extensive experience supervising ${f.writingType} writing at the highest level.

WRITING TYPE: ${f.writingType}
TOPIC: ${f.topic}
THESIS / CENTRAL ARGUMENT: ${f.thesis || "not yet defined — help the author develop one"}
REQUIRED SECTIONS: ${f.sections || "standard sections for this type of academic writing"}
CITATION STYLE: ${f.citationStyle || "not specified — flag where citations are needed"}
TONE: ${f.tone}
TARGET WORD COUNT: ${f.wordCount || "not specified"}
OUTPUT LANGUAGE: ${f.language || "same as input"}
CURRENT DRAFT OR NOTES (if any):
${f.draft || "[No draft provided — provide structural guidance and a detailed outline]"}

YOUR TASK:
${f.draft
  ? `1. Diagnose the current draft: structure, argumentation, clarity, academic register, citation gaps.
2. Provide section-by-section feedback: [SECTION: name] → [ISSUE] → [SUGGESTED REVISION].
3. Rewrite or substantially improve any section the author flags.
4. Mark missing citations: [CITATION NEEDED: reason].
5. End with a prioritized revision checklist.`
  : `1. Propose a detailed outline with section titles, purpose, and approximate word count per section.
2. For each section, describe what it must contain and how it connects to the central argument.
3. Provide an example opening paragraph.
4. List 5 key academic writing principles for this specific writing type.`}`;
}

const PROMPT_MODULES = [
  { id: "notes", icon: "📝", label: "Note Amelioration", Form: NoteAmeliorationForm },
  { id: "simplify", icon: "💡", label: "Concept Simplification", Form: SimplificationForm },
  { id: "map", icon: "🗺️", label: "Concept Map", Form: ConceptMapForm },
  { id: "summarise", icon: "📄", label: "Summarisation", Form: SummarisationForm },
  { id: "write", icon: "✍️", label: "Writing Assistance", Form: WritingAssistanceForm },
];

const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
const ta = { ...inp, resize: "vertical", minHeight: 90 };
const btnStyle = { width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 6, letterSpacing: "0.02em" };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--label)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}

function NoteAmeliorationForm({ onSubmit, loading }) {
  const [f, setF] = useState({ notes: "", structure: "", detail: "", focus: "", language: "", supplementary: "", pauseAfterStep2: "no" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <Field label="Raw Notes *"><textarea style={{ ...ta, minHeight: 140 }} placeholder="Paste your raw notes here…" value={f.notes} onChange={set("notes")} /></Field>
      <Field label="Desired Structure"><input style={inp} placeholder="e.g. thematic sections, chronological, argument-based…" value={f.structure} onChange={set("structure")} /></Field>
      <Field label="Level of Detail">
        <select style={inp} value={f.detail} onChange={set("detail")}>
          <option value="">Preserve original level</option>
          <option value="concise — trim to essentials only">Concise</option>
          <option value="standard academic depth">Standard</option>
          <option value="comprehensive — expand all concepts fully">Comprehensive</option>
        </select>
      </Field>
      <Field label="Focus Areas"><input style={inp} placeholder="e.g. legal provisions, key dates, theoretical frameworks…" value={f.focus} onChange={set("focus")} /></Field>
      <Field label="Output Language"><input style={inp} placeholder="e.g. English, Italian — leave blank to match input" value={f.language} onChange={set("language")} /></Field>
      <Field label="Pause after Step 2 for structure approval?">
        <select style={inp} value={f.pauseAfterStep2} onChange={set("pauseAfterStep2")}>
          <option value="no">No — proceed automatically</option>
          <option value="yes">Yes — wait for my approval</option>
        </select>
      </Field>
      <Field label="Supplementary Instructions"><textarea style={ta} placeholder="Any domain-specific directives…" value={f.supplementary} onChange={set("supplementary")} /></Field>
      <button style={btnStyle} disabled={loading || !f.notes.trim()} onClick={() => onSubmit(buildNoteAmeliorationPrompt(f))}>
        {loading ? "Processing…" : "✦ Ameliorate Notes"}
      </button>
    </div>
  );
}

function SimplificationForm({ onSubmit, loading }) {
  const [f, setF] = useState({ concept: "", level: "undergraduate", style: "step-by-step with examples", language: "" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <Field label="Concept or Text *"><textarea style={{ ...ta, minHeight: 120 }} placeholder="Paste the concept or topic to simplify…" value={f.concept} onChange={set("concept")} /></Field>
      <Field label="Target Level">
        <select style={inp} value={f.level} onChange={set("level")}>
          <option value="high-school student">High School</option>
          <option value="undergraduate">Undergraduate</option>
          <option value="graduate / postgraduate">Graduate / Postgraduate</option>
          <option value="specialist in this field">Specialist</option>
        </select>
      </Field>
      <Field label="Explanation Style">
        <select style={inp} value={f.style} onChange={set("style")}>
          <option value="step-by-step with examples">Step-by-step with examples</option>
          <option value="analogy-based">Analogy-based</option>
          <option value="Socratic — question and answer">Socratic (Q&A)</option>
          <option value="visual description — describe as if drawing a diagram">Visual / Diagrammatic</option>
        </select>
      </Field>
      <Field label="Output Language"><input style={inp} placeholder="Leave blank to match input" value={f.language} onChange={set("language")} /></Field>
      <button style={btnStyle} disabled={loading || !f.concept.trim()} onClick={() => onSubmit(buildSimplificationPrompt(f))}>
        {loading ? "Processing…" : "✦ Simplify Concept"}
      </button>
    </div>
  );
}

function ConceptMapForm({ onSubmit, loading }) {
  const [f, setF] = useState({ topic: "", field: "", depth: "intermediate (8–15 nodes)", language: "" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <Field label="Topic or Notes *"><textarea style={{ ...ta, minHeight: 120 }} placeholder="Paste a topic or notes to map…" value={f.topic} onChange={set("topic")} /></Field>
      <Field label="Subject Field"><input style={inp} placeholder="e.g. EU Law, Molecular Biology…" value={f.field} onChange={set("field")} /></Field>
      <Field label="Map Depth">
        <select style={inp} value={f.depth} onChange={set("depth")}>
          <option value="overview (4–7 nodes)">Overview (4–7 nodes)</option>
          <option value="intermediate (8–15 nodes)">Intermediate (8–15 nodes)</option>
          <option value="detailed (16–30 nodes)">Detailed (16–30+ nodes)</option>
        </select>
      </Field>
      <Field label="Output Language"><input style={inp} placeholder="Leave blank to match input" value={f.language} onChange={set("language")} /></Field>
      <button style={btnStyle} disabled={loading || !f.topic.trim()} onClick={() => onSubmit(buildConceptMapPrompt(f))}>
        {loading ? "Generating Map…" : "✦ Generate Concept Map"}
      </button>
    </div>
  );
}

function SummarisationForm({ onSubmit, loading }) {
  const [f, setF] = useState({ text: "", length: "medium (≈200–300 words)", format: "structured outline with headings", focus: "", language: "" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <Field label="Text or Notes *"><textarea style={{ ...ta, minHeight: 140 }} placeholder="Paste the document or notes to summarise…" value={f.text} onChange={set("text")} /></Field>
      <Field label="Summary Length">
        <select style={inp} value={f.length} onChange={set("length")}>
          <option value="short (≈100 words)">Short (≈100 words)</option>
          <option value="medium (≈200–300 words)">Medium (≈200–300 words)</option>
          <option value="long (≈500 words)">Long (≈500 words)</option>
          <option value="scale to source length">Scale to source</option>
        </select>
      </Field>
      <Field label="Format">
        <select style={inp} value={f.format} onChange={set("format")}>
          <option value="structured outline with headings">Structured outline</option>
          <option value="continuous prose paragraphs">Continuous prose</option>
          <option value="bullet-point list of main points">Bullet points</option>
          <option value="executive summary style">Executive summary</option>
        </select>
      </Field>
      <Field label="Key Focus Areas"><input style={inp} placeholder="e.g. legal definitions, empirical findings…" value={f.focus} onChange={set("focus")} /></Field>
      <Field label="Output Language"><input style={inp} placeholder="Leave blank to match input" value={f.language} onChange={set("language")} /></Field>
      <button style={btnStyle} disabled={loading || !f.text.trim()} onClick={() => onSubmit(buildSummarisationPrompt(f))}>
        {loading ? "Summarising…" : "✦ Summarise"}
      </button>
    </div>
  );
}

function WritingAssistanceForm({ onSubmit, loading }) {
  const [f, setF] = useState({ writingType: "academic essay", topic: "", thesis: "", sections: "", citationStyle: "Chicago", tone: "formal academic", wordCount: "", language: "", draft: "" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <Field label="Writing Type">
        <select style={inp} value={f.writingType} onChange={set("writingType")}>
          <option value="academic essay">Academic Essay</option>
          <option value="research paper">Research Paper</option>
          <option value="thesis chapter">Thesis Chapter</option>
          <option value="full thesis / dissertation">Full Thesis / Dissertation</option>
          <option value="literature review">Literature Review</option>
          <option value="abstract">Abstract</option>
          <option value="case study analysis">Case Study Analysis</option>
        </select>
      </Field>
      <Field label="Topic *"><input style={inp} placeholder="What is the paper about?" value={f.topic} onChange={set("topic")} /></Field>
      <Field label="Thesis / Central Argument"><input style={inp} placeholder="Your main argument or hypothesis (optional)" value={f.thesis} onChange={set("thesis")} /></Field>
      <Field label="Required Sections"><input style={inp} placeholder="e.g. Introduction, Literature Review, Methodology…" value={f.sections} onChange={set("sections")} /></Field>
      <Field label="Citation Style">
        <select style={inp} value={f.citationStyle} onChange={set("citationStyle")}>
          <option value="Chicago">Chicago</option>
          <option value="APA 7th">APA 7th</option>
          <option value="MLA 9th">MLA 9th</option>
          <option value="Harvard">Harvard</option>
          <option value="Oxford (OSCOLA)">OSCOLA (Law)</option>
          <option value="Vancouver">Vancouver</option>
          <option value="not specified">Not specified</option>
        </select>
      </Field>
      <Field label="Tone">
        <select style={inp} value={f.tone} onChange={set("tone")}>
          <option value="formal academic">Formal academic</option>
          <option value="analytical and critical">Analytical / Critical</option>
          <option value="argumentative">Argumentative</option>
          <option value="descriptive and neutral">Descriptive / Neutral</option>
        </select>
      </Field>
      <Field label="Target Word Count"><input style={inp} placeholder="e.g. 3000 words" value={f.wordCount} onChange={set("wordCount")} /></Field>
      <Field label="Output Language"><input style={inp} placeholder="Leave blank to match input" value={f.language} onChange={set("language")} /></Field>
      <Field label="Current Draft or Notes (optional)"><textarea style={{ ...ta, minHeight: 120 }} placeholder="Paste your draft or notes — leave blank for a full outline…" value={f.draft} onChange={set("draft")} /></Field>
      <button style={btnStyle} disabled={loading || !f.topic.trim()} onClick={() => onSubmit(buildWritingAssistancePrompt(f))}>
        {loading ? "Processing…" : "✦ Get Writing Assistance"}
      </button>
    </div>
  );
}

export default function App() {
  const [tags, setTags] = useState([{ id: "1", name: "General", color: COLORS[0] }]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [newTaskTag, setNewTaskTag] = useState("1");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [filter, setFilter] = useState("all");
  const [panel, setPanel] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conceptMapHtml, setConceptMapHtml] = useState(null);
  const [tagModal, setTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(COLORS[1]);
  const responseRef = useRef(null);

  useEffect(() => {
    if ((aiResponse || conceptMapHtml) && responseRef.current)
      responseRef.current.scrollIntoView({ behavior: "smooth" });
  }, [aiResponse, conceptMapHtml]);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(p => [...p, { id: generateId(), text: newTask.trim(), tagId: newTaskTag, done: false, deadline: newTaskDeadline }]);
    setNewTask(""); setNewTaskDeadline("");
  };

  const toggleTask = id => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = id => setTasks(p => p.filter(t => t.id !== id));

  const addTag = () => {
    if (!newTagName.trim()) return;
    setTags(p => [...p, { id: generateId(), name: newTagName.trim(), color: newTagColor }]);
    setNewTagName(""); setTagModal(false);
  };

  const deleteTag = id => {
    setTags(p => p.filter(t => t.id !== id));
    setTasks(p => p.map(t => t.tagId === id ? { ...t, tagId: "1" } : t));
  };

  const visibleTasks = filter === "all" ? tasks : tasks.filter(t => t.tagId === filter);
  const tagMap = Object.fromEntries(tags.map(t => [t.id, t]));

  const handleAiSubmit = async (prompt, moduleId) => {
    setLoading(true); setAiResponse(null); setConceptMapHtml(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.map(b => b.text || "").join("") || "No response.";
      if (moduleId === "map") {
        const match = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i) || text.match(/<html[\s\S]*<\/html>/i);
        if (match) { setConceptMapHtml(match[0]); setAiResponse(null); }
        else setAiResponse(text);
      } else {
        setAiResponse(text);
      }
    } catch (e) {
      setAiResponse("⚠️ Error: " + e.message);
    }
    setLoading(false);
  };

  const css = `
    :root {
      --bg: #0f1117; --surface: #181c27; --surface2: #1e2235;
      --border: #2a2f45; --text: #e8ecf4; --muted: #7a82a0;
      --label: #9099b8; --accent: #6C63FF; --input-bg: #13172050;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    input, textarea, select { color-scheme: dark; }
  `;

  const activeModule = PROMPT_MODULES.find(m => m.id === panel);

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{ width: 260, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0 }}>
          <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.03em" }}>📚 StudyDesk</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Student Task Manager</div>
          </div>
          <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Subjects</div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {[{ id: "all", name: "All Tasks", color: "#7a82a0" }, ...tags].map(tag => (
              <div key={tag.id} onClick={() => setFilter(tag.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", cursor: "pointer", background: filter === tag.id ? "var(--surface2)" : "transparent", borderLeft: filter === tag.id ? `3px solid ${tag.color}` : "3px solid transparent", transition: "all 0.15s" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, color: filter === tag.id ? "var(--text)" : "var(--muted)" }}>{tag.name}</span>
                {tag.id !== "all" && tag.id !== "1" && (
                  <span onClick={e => { e.stopPropagation(); deleteTag(tag.id); }} style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", opacity: 0.5 }}>×</span>
                )}
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{tag.id === "all" ? tasks.length : tasks.filter(t => t.tagId === tag.id).length}</span>
              </div>
            ))}
            <div onClick={() => setTagModal(true)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>+</span> Add Subject
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ padding: "0 20px 8px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Tools</div>
            {PROMPT_MODULES.map(m => (
              <div key={m.id} onClick={() => { setPanel(panel === m.id ? null : m.id); setAiResponse(null); setConceptMapHtml(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", cursor: "pointer", background: panel === m.id ? "var(--surface2)" : "transparent", borderLeft: panel === m.id ? "3px solid var(--accent)" : "3px solid transparent", transition: "all 0.15s" }}>
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                <span style={{ fontSize: 13, color: panel === m.id ? "var(--text)" : "var(--muted)" }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Tasks */}
          <div style={{ flex: panel ? "0 0 380px" : "1", overflowY: "auto", padding: 28, transition: "flex 0.2s" }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>{filter === "all" ? "All Tasks" : tagMap[filter]?.name}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 22 }}>{visibleTasks.filter(t => !t.done).length} remaining</div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 22 }}>
              <input style={{ ...inp, marginBottom: 10 }} placeholder="New task…" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
              <div style={{ display: "flex", gap: 8 }}>
                <select style={{ ...inp, flex: 1 }} value={newTaskTag} onChange={e => setNewTaskTag(e.target.value)}>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" style={{ ...inp, flex: 1 }} value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} />
              </div>
              <button style={{ ...btnStyle, marginTop: 10 }} onClick={addTask}>+ Add Task</button>
            </div>
            {visibleTasks.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, marginTop: 40 }}>No tasks yet — add one above.</div>}
            {visibleTasks.map(task => {
              const tag = tagMap[task.tagId];
              const overdue = task.deadline && !task.done && new Date(task.deadline) < new Date();
              return (
                <div key={task.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 12, opacity: task.done ? 0.5 : 1 }}>
                  <div onClick={() => toggleTask(task.id)} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${tag?.color || "var(--border)"}`, background: task.done ? (tag?.color || "var(--accent)") : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {task.done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--muted)" : "var(--text)" }}>{task.text}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                      <span style={{ fontSize: 11, background: (tag?.color || "#555") + "22", color: tag?.color || "var(--muted)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{tag?.name}</span>
                      {task.deadline && <span style={{ fontSize: 11, color: overdue ? "#FF6584" : "var(--muted)" }}>📅 {task.deadline}{overdue ? " ⚠️" : ""}</span>}
                    </div>
                  </div>
                  <span onClick={() => deleteTask(task.id)} style={{ color: "var(--muted)", cursor: "pointer", fontSize: 16, opacity: 0.4 }}>×</span>
                </div>
              );
            })}
          </div>

          {/* AI Panel */}
          {panel && activeModule && (
            <div style={{ flex: 1, overflowY: "auto", borderLeft: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{activeModule.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{activeModule.label}</span>
                <span onClick={() => { setPanel(null); setAiResponse(null); setConceptMapHtml(null); }} style={{ marginLeft: "auto", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>×</span>
              </div>
              <div style={{ padding: 24 }}>
                <activeModule.Form onSubmit={p => handleAiSubmit(p, activeModule.id)} loading={loading} />
                {loading && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "30px 0", fontSize: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>Processing…
                  </div>
                )}
                {aiResponse && (
                  <div ref={responseRef} style={{ marginTop: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Response</span>
                      <button onClick={() => navigator.clipboard.writeText(aiResponse)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>Copy</button>
                    </div>
                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--text)" }}>{aiResponse}</div>
                  </div>
                )}
                {conceptMapHtml && (
                  <div ref={responseRef} style={{ marginTop: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Interactive Concept Map</span>
                      <button onClick={() => { const w = window.open(); w.document.write(conceptMapHtml); w.document.close(); }} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>Open fullscreen</button>
                    </div>
                    <iframe srcDoc={conceptMapHtml} style={{ width: "100%", height: 500, border: "1px solid var(--border)", borderRadius: 12, background: "#fff" }} sandbox="allow-scripts" title="Concept Map" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tag Modal */}
      {tagModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setTagModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>New Subject Tag</div>
            <Field label="Subject Name"><input style={inp} placeholder="e.g. EU Law, Biochemistry…" value={newTagName} onChange={e => setNewTagName(e.target.value)} autoFocus /></Field>
            <Field label="Color">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setNewTagColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: newTagColor === c ? "3px solid #fff" : "3px solid transparent" }} />
                ))}
              </div>
            </Field>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button style={{ ...btnStyle, flex: 1, background: "var(--border)" }} onClick={() => setTagModal(false)}>Cancel</button>
              <button style={{ ...btnStyle, flex: 1 }} onClick={addTag} disabled={!newTagName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
