import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronUp, ChevronDown, Sparkles, Upload, RotateCcw, Volume2, VolumeX, Pause, Play,
  Leaf, Droplet, Sun, Zap, Book, Brain, Coffee, Heart, Wind, Flame, Star, Target,
  CheckCircle, Lightbulb, Clock, MessageCircle, Users, Home, Map, Music, Camera,
  Palette, Code, Globe, Smile, TreePine, Mountain, Waves, Cloud, Moon, Rocket,
  Puzzle, Compass, Anchor, Feather, Gift, Key, Layers, Shield,
} from "lucide-react";

const ICON_MAP = {
  Leaf, Droplet, Sun, Zap, Book, Brain, Coffee, Heart, Wind, Flame, Star, Target,
  CheckCircle, Lightbulb, Clock, MessageCircle, Users, Home, Map, Music, Camera,
  Palette, Code, Globe, Smile, TreePine, Mountain, Waves, Cloud, Moon, Rocket,
  Puzzle, Compass, Anchor, Feather, Gift, Key, Layers, Shield, Sparkles,
};
const ICON_NAMES = Object.keys(ICON_MAP);

const SAMPLE_TEXT = `Photosynthesis is the process plants use to turn sunlight into energy. It happens mainly in the leaves, inside structures called chloroplasts. Chlorophyll, the green pigment in chloroplasts, absorbs sunlight. The plant takes in carbon dioxide from the air through tiny pores called stomata, and water from the soil through its roots. Using the energy from sunlight, the plant combines the water and carbon dioxide to produce glucose, a sugar it uses for energy and growth. Oxygen is released as a byproduct, which is why plants are essential to the air we breathe. This whole process only happens efficiently when there's enough light, which is why plants grow toward windows or sunlight.`;

const GLOWS = ["#E3A857", "#6FBFB0", "#C98BD9", "#7BA7E3", "#E38B7B"];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
function safeColor(color, fallbackIndex) {
  return HEX_RE.test(color) ? color : GLOWS[fallbackIndex % GLOWS.length];
}
function safeIcon(name) {
  return ICON_MAP[name] || Sparkles;
}
function normalizeSteps(rawSteps) {
  return rawSteps.map((s, i) => {
    if (typeof s === "string") return { text: s, icon: "Sparkles", color: GLOWS[i % GLOWS.length] };
    return {
      text: s.text || "",
      icon: ICON_MAP[s.icon] ? s.icon : "Sparkles",
      color: safeColor(s.color, i),
    };
  });
}

async function generateSteps(sourceText) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Generation failed.");
  }
  return res.json();
}

export default function EchoBridgeAI() {
  const [stage, setStage] = useState("input"); // input | loading | feed
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [deck, setDeck] = useState(null);
  const [index, setIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [voicesReady, setVoicesReady] = useState(false);

  const touchStartY = useRef(null);
  const utterRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const estDurationRef = useRef(1);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";

  useEffect(() => {
    if (!speechSupported) {
      setVoicesReady(false);
      setVoiceOn(false);
      return;
    }
    function loadVoices() {
      if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  function pickVoice() {
    if (!speechSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /en-US/.test(v.lang) && /Female|Samantha|Google US English/i.test(v.name)) ||
      voices.find((v) => /en/.test(v.lang)) ||
      voices[0]
    );
  }

  const speak = useCallback((text) => {
    if (!speechSupported) {
      // No speech engine available — auto-advance on a timer instead so the feed still works.
      const words = text.trim().split(/\s+/).length;
      const estMs = Math.max((words / 150) * 60 * 1000, 900);
      setSpeaking(false);
      setSpeechProgress(0);
      startTimeRef.current = performance.now();
      estDurationRef.current = estMs;
      const tick = () => {
        const elapsed = performance.now() - startTimeRef.current;
        const pct = Math.min(elapsed / estMs, 1);
        setSpeechProgress(pct);
        if (pct < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else if (autoAdvance) {
          setTimeout(() => advance(), 400);
        }
      };
      tick();
      return;
    }
    window.speechSynthesis.cancel();
    cancelAnimationFrame(rafRef.current);
    const utter = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) utter.voice = v;
    utter.rate = 0.98;
    utter.pitch = 1.0;

    // rough duration estimate for progress ring: ~150 wpm speech
    const words = text.trim().split(/\s+/).length;
    estDurationRef.current = Math.max((words / 150) * 60 * 1000, 900);

    utter.onstart = () => {
      setSpeaking(true);
      setPaused(false);
      startTimeRef.current = performance.now();
      tickProgress();
    };
    utter.onend = () => {
      setSpeaking(false);
      cancelAnimationFrame(rafRef.current);
      setSpeechProgress(1);
      if (autoAdvance) {
        setTimeout(() => advance(), 500);
      }
    };
    utter.onerror = () => {
      setSpeaking(false);
      cancelAnimationFrame(rafRef.current);
    };
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [autoAdvance]); // eslint-disable-line react-hooks/exhaustive-deps

  function tickProgress() {
    const elapsed = performance.now() - startTimeRef.current;
    const pct = Math.min(elapsed / estDurationRef.current, 1);
    setSpeechProgress(pct);
    if (pct < 1) rafRef.current = requestAnimationFrame(tickProgress);
  }

  function advance() {
    setIndex((i) => {
      if (!deck) return i;
      if (i >= deck.steps.length - 1) return i;
      return i + 1;
    });
  }

  // speak whenever the active step changes, while in feed stage
  useEffect(() => {
    if (stage !== "feed" || !deck) return;
    setSpeechProgress(0);
    if (voiceOn || !speechSupported) {
      speak(deck.steps[index].text);
    } else {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stage, deck, voiceOn]);

  async function handleGenerate(text) {
    if (!text || text.trim().length < 20) {
      setError("Paste a bit more content — at least a paragraph — so there's something to work with.");
      return;
    }
    setError("");
    setStage("loading");
    try {
      const result = await generateSteps(text.trim());
      setDeck({ title: result.title || "Your feed", steps: normalizeSteps(result.steps || []) });
      setIndex(0);
      setStage("feed");
    } catch (e) {
      setError("Something went wrong generating your feed. Try again.");
      setStage("input");
    }
  }

  function next() {
    if (!deck) return;
    setIndex((i) => Math.min(i + 1, deck.steps.length - 1));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  function togglePause() {
    if (!speechSupported) return;
    if (!speaking && !paused) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      startTimeRef.current = performance.now() - speechProgress * estDurationRef.current;
      tickProgress();
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
      cancelAnimationFrame(rafRef.current);
    }
  }

  function toggleVoice() {
    if (!speechSupported) return;
    setVoiceOn((v) => {
      const nv = !v;
      if (!nv) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return nv;
    });
  }

  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchStartY.current == null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 50) {
      if (delta > 0) next();
      else prev();
    }
    touchStartY.current = null;
  }

  function reset() {
    if (speechSupported) window.speechSynthesis.cancel();
    setStage("input");
    setInputText("");
    setDeck(null);
    setIndex(0);
    setError("");
  }

  const currentStep = deck ? deck.steps[index] : null;
  const glow = currentStep ? currentStep.color : GLOWS[0];
  const StepIcon = currentStep ? safeIcon(currentStep.icon) : Sparkles;
  const isLast = deck && index === deck.steps.length - 1;

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% -10%, #1F2C3E 0%, #131A24 55%, #0D1219 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(227,168,87,0.08), transparent 40%), radial-gradient(circle at 85% 75%, rgba(111,191,176,0.08), transparent 40%)",
        }}
      />

      {/* INPUT STAGE */}
      {stage === "input" && (
        <div
          className="w-full max-w-md rounded-[28px] p-6 relative"
          style={{ background: "linear-gradient(180deg, #1A2432 0%, #151D28 100%)", border: "1px solid #2A3648", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)" }}
        >
          <div className="flex items-center gap-1 mb-3" style={{ color: "#E3A857" }}>
            <Sparkles size={14} />
            <span className="text-[11px] tracking-[0.15em] uppercase font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
              Echo Bridge
            </span>
          </div>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: "#F1EEE6" }}>
            Turn anything into a narrated feed
          </h1>
          <p className="text-sm mb-5 leading-relaxed" style={{ color: "#8C97AC", fontFamily: "'Inter', sans-serif" }}>
            Paste in something you're trying to learn. AI breaks it into short, complete steps — narrated aloud, one at a time, like a feed instead of a document.
          </p>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your content here..."
            className="w-full rounded-2xl p-4 text-sm mb-3 resize-none focus:outline-none"
            style={{ background: "#1E2938", border: "1px solid #2A3648", color: "#F1EEE6", minHeight: 140, fontFamily: "'Inter', sans-serif" }}
          />

          {error && (
            <p className="text-xs mb-3" style={{ color: "#E38B7B", fontFamily: "'Inter', sans-serif" }}>
              {error}
            </p>
          )}

          <button
            onClick={() => handleGenerate(inputText)}
            className="w-full rounded-2xl py-3.5 text-sm mb-3 transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #E3A857, #C98540)", color: "#131A24", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}
          >
            Generate my feed
          </button>

          <button
            onClick={() => handleGenerate(SAMPLE_TEXT)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm"
            style={{ background: "#1E2938", border: "1px solid #2A3648", color: "#B7C0D1", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
          >
            <Upload size={14} />
            Try it with a sample paragraph
          </button>

          <p className="text-[11px] mt-3 text-center" style={{ color: "#4A566A", fontFamily: "'Inter', sans-serif" }}>
            {speechSupported
              ? "Voice narration uses your device's built-in speech engine."
              : "Voice narration isn't available in this preview environment — steps will still auto-advance on a timed read-through."}
          </p>
        </div>
      )}

      {/* LOADING STAGE */}
      {stage === "loading" && (
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-4"
            style={{ border: "3px solid #2A3648", borderTopColor: "#E3A857", animation: "eb-spin 0.9s linear infinite" }}
          />
          <p style={{ color: "#8C97AC", fontFamily: "'Inter', sans-serif", fontSize: 14 }}>Breaking this into short narrated steps...</p>
        </div>
      )}

      {/* FEED STAGE */}
      {stage === "feed" && deck && (
        <div
          className="w-full h-screen flex flex-col items-center justify-center relative px-6"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* per-step generative visual layer */}
          <div
            key={`bg-${index}`}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 38%, ${glow}26 0%, transparent 55%)`,
              animation: "eb-bgfade 0.6s ease-out",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 340, height: 340, top: "18%", left: "50%",
              transform: "translateX(-50%)",
              background: `radial-gradient(circle, ${glow}20 0%, transparent 70%)`,
              filter: "blur(10px)",
            }}
          />

          <div className="absolute top-6 left-6 right-6 flex gap-1.5">
            {deck.steps.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "#2A3648" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: glow,
                    width: i < index ? "100%" : i === index ? `${speechProgress * 100}%` : "0%",
                    transition: i === index ? "none" : "width 0.3s",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-12 right-6 flex gap-2">
            {speechSupported && (
              <button
                onClick={toggleVoice}
                className="p-2 rounded-full"
                style={{ background: "#1E2938", border: "1px solid #2A3648", color: voiceOn ? glow : "#7C8AA0" }}
                aria-label={voiceOn ? "Mute narration" : "Unmute narration"}
              >
                {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            )}
            <button
              onClick={reset}
              className="p-2 rounded-full"
              style={{ background: "#1E2938", border: "1px solid #2A3648", color: "#7C8AA0" }}
              aria-label="Start over"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="text-center max-w-sm relative z-10">
            <div
              key={`icon-${index}`}
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${glow}33, ${glow}11)`,
                border: `1px solid ${glow}55`,
                boxShadow: `0 0 30px -8px ${glow}88`,
                animation: "eb-icon-pop 0.5s ease-out",
              }}
            >
              <StepIcon size={28} color={glow} strokeWidth={1.8} />
            </div>
            <div className="text-[11px] uppercase tracking-[0.15em] mb-4 font-semibold" style={{ color: glow, fontFamily: "'Inter', sans-serif" }}>
              {deck.title} · {index + 1} / {deck.steps.length}
            </div>
            <p
              key={index}
              className="text-2xl leading-snug"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: "#F1EEE6", animation: "eb-rise 0.4s ease-out" }}
            >
              {currentStep.text}
            </p>
            {speechSupported && voiceOn && speaking && (
              <div className="flex items-center justify-center gap-1 mt-6">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full"
                    style={{
                      background: glow,
                      height: 10,
                      animation: `eb-wave 0.9s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="absolute bottom-10 flex flex-col items-center gap-3">
            {speechSupported && voiceOn && (
              <button onClick={togglePause} className="p-2 rounded-full" style={{ background: "#1E2938", border: "1px solid #2A3648", color: glow }} aria-label={paused ? "Resume narration" : "Pause narration"}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <div className="flex items-center gap-6">
              <button onClick={prev} disabled={index === 0} className="p-2 rounded-full disabled:opacity-20" style={{ color: "#7C8AA0" }} aria-label="Previous">
                <ChevronUp size={20} />
              </button>
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "#4A566A", fontFamily: "'Inter', sans-serif" }}>
                swipe
              </span>
              <button
                onClick={isLast ? reset : next}
                className="p-2 rounded-full"
                style={{ color: glow }}
                aria-label="Next"
              >
                <ChevronDown size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;600;700&display=swap');
        @keyframes eb-spin { to { transform: rotate(360deg); } }
        @keyframes eb-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes eb-icon-pop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes eb-bgfade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes eb-wave { 0%, 100% { height: 6px; } 50% { height: 18px; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
