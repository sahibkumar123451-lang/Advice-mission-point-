import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Send, Sparkles, MessageSquareText, Edit3 } from 'lucide-react';
import type { ChatMessage } from '../types/coaching';
import { formatFriendlyAiError, retryWithExponentialBackoff } from '../utils/coachingLogic';

interface AdviceMissionAIProps {
  externalPrompt?: string | null;
  onExternalPromptConsumed?: () => void;
  focusTrigger?: number;
}

const STARTER_QUESTIONS = [
  'Explain Newton’s Second Law (F = ma) in simple Hindi and English.',
  'How do I solve quadratic equations step by step?',
  'What is Photosynthesis? Explain with an easy example.',
  'Difference between Active Voice and Passive Voice with examples.',
];

function renderFormattedText(text: string) {
  const cleaned = text.replace(/\$([^$\n]+)\$/g, '$1');
  const lines = cleaned.split('\n');
  return (
    <div className="space-y-1.5 text-sm sm:text-[15px] leading-relaxed">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={index} className="h-1.5" />;
        }
        // Parse **bold** segments safely without dangerouslySetInnerHTML
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={index} className="break-words">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return (
                  <strong key={pIdx} className="font-semibold text-slate-950">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function AdviceMissionAI({
  externalPrompt,
  onExternalPromptConsumed,
  focusTrigger,
}: AdviceMissionAIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [languagePref, setLanguagePref] = useState<'bilingual' | 'english' | 'hindi'>('bilingual');
  const [loading, setLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string>('Preparing your fast answer...');
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      inputRef.current?.focus();
    }
  }, [focusTrigger]);

  useEffect(() => {
    if (externalPrompt) {
      setInput(externalPrompt);
      inputRef.current?.focus();
      onExternalPromptConsumed?.();
    }
  }, [externalPrompt, onExternalPromptConsumed]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, statusNotice]);

  async function askQuestion(
    questionText: string,
    options: { reuseLastUserBubble?: boolean } = {},
  ) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLastFailedQuestion(null);
    setStatusNotice('Preparing your fast answer...');

    const lastMsg = messages[messages.length - 1];
    const shouldReuseBubble =
      Boolean(options.reuseLastUserBubble) &&
      lastMsg?.role === 'user' &&
      lastMsg.text.trim() === trimmed;

    const nextMessages: ChatMessage[] = shouldReuseBubble
      ? messages
      : [
          ...messages,
          {
            id: `u-${Date.now()}`,
            role: 'user',
            text: trimmed,
            createdAt: new Date().toISOString(),
          },
        ];

    if (!shouldReuseBubble) {
      setMessages(nextMessages);
      setInput('');
    }
    setLoading(true);

    const payload = {
      messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
      languagePreference: languagePref,
    };

    let receivedAnyDelta = false;
    const delayTimer = window.setTimeout(() => {
      if (!receivedAnyDelta) {
        setStatusNotice((prev) =>
          prev === 'Preparing your fast answer...'
            ? 'Checking fastest available AI model — your answer is on the way...'
            : prev,
        );
      }
    }, 2500);

    try {
      const response = await retryWithExponentialBackoff(
        async () => {
          const res = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res;
        },
        {
          maxRetries: 2,
          baseDelayMs: 400,
          maxDelayMs: 1600,
          onRetry: () => {
            setStatusNotice('High traffic detected — switching gently to backup route...');
          },
          shouldRetry: (err) => {
            const msg = err instanceof Error ? err.message.toLowerCase() : '';
            return (
              msg.includes('http 50') ||
              msg.includes('http 429') ||
              msg.includes('failed to fetch') ||
              msg.includes('network')
            );
          },
        },
      );

      const contentType = response.headers.get('content-type') || '';
      if (
        !response.ok ||
        !response.body ||
        contentType.includes('application/json') ||
        contentType.includes('text/html')
      ) {
        const rawText = await response.text();
        let data: { answer?: string; error?: string } = {};
        if (!contentType.includes('text/html')) {
          try {
            data = JSON.parse(rawText) as { answer?: string; error?: string };
          } catch {
            data = {};
          }
        }
        setLastFailedQuestion(trimmed);
        setError(
          data.error ||
            formatFriendlyAiError(
              contentType.includes('text/html') ? '404' : `HTTP ${response.status}`,
            ),
        );
        return;
      }

      const aiMsgId = `a-${Date.now()}`;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let streamError: string | null = null;
      let addedAssistantBubble = false;

      const appendDelta = (delta: string) => {
        receivedAnyDelta = true;
        accumulatedText += delta;
        if (!addedAssistantBubble) {
          addedAssistantBubble = true;
          const initialMsg: ChatMessage = {
            id: aiMsgId,
            role: 'assistant',
            text: accumulatedText,
            createdAt: new Date().toISOString(),
          };
          setMessages([...nextMessages, initialMsg]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, text: accumulatedText } : m)),
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr) as {
              delta?: string;
              done?: boolean;
              status?: string;
              message?: string;
              error?: string;
            };
            if (evt.status && evt.message && !receivedAnyDelta) {
              setStatusNotice(evt.message);
            }
            if (evt.delta) {
              appendDelta(evt.delta);
            }
            if (evt.error) {
              streamError = evt.error;
            }
          } catch {
            // Ignore malformed SSE fragment
          }
        }
      }

      if (!accumulatedText.trim()) {
        // One quiet non-streaming fallback call to /api/ai/ask if SSE ended without tokens
        if (!streamError) {
          setStatusNotice('Completing answer via backup route...');
          const fallbackRes = await fetch('/api/ai/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const fallbackData = (await fallbackRes.json().catch(() => ({}))) as {
            answer?: string;
            error?: string;
          };
          if (fallbackRes.ok && fallbackData.answer?.trim()) {
            appendDelta(fallbackData.answer.trim());
            return;
          }
          if (fallbackData.error) {
            streamError = fallbackData.error;
          }
        }

        setLastFailedQuestion(trimmed);
        setError(streamError || formatFriendlyAiError('empty'));
      }
    } catch (err) {
      setLastFailedQuestion(trimmed);
      setError(
        formatFriendlyAiError(
          err instanceof Error ? err.message : 'network error',
        ),
      );
    } finally {
      window.clearTimeout(delayTimer);
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void askQuestion(input);
  }

  return (
    <section
      id="advice-mission-ai"
      className="py-16 lg:py-24 bg-white border-b border-slate-200/80"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold text-amber-700">
              Instant Educational Doubt Solver
            </p>
            <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
              Advice Mission AI
            </h2>
            <p className="mt-1.5 text-base font-medium text-slate-600">
              Your Coaching, Your AI, Your Success.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Answer language preference"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
            >
              {(
                [
                  { id: 'bilingual', label: 'Hindi + English' },
                  { id: 'english', label: 'Simple English' },
                  { id: 'hindi', label: 'हिन्दी' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLanguagePref(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    languagePref === opt.id
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                  setLastFailedQuestion(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Chat Container */}
        <div className="rounded-2xl border border-slate-200 bg-[#FAF9F6] overflow-hidden">
          {/* Scrollable Thread */}
          <div
            ref={threadRef}
            aria-live="polite"
            className="h-[400px] sm:h-[440px] overflow-y-auto p-5 sm:p-6 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
                    <MessageSquareText className="w-4 h-4 text-amber-700" aria-hidden="true" />
                    <span>Ask any question directly — no class or subject selection needed.</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Type your doubt in English, Hindi, or Hinglish below. Advice Mission AI gives a short direct answer followed by a simple step-by-step explanation.
                  </p>
                </div>

                <div className="pt-6">
                  <p className="text-xs font-semibold text-slate-500 mb-3">
                    Quick Doubt Starters — Click to Ask
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {STARTER_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void askQuestion(q)}
                        className="text-left p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 transition-colors text-sm text-slate-800 font-medium leading-snug cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold mb-1 ${
                        msg.role === 'user' ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      {msg.role === 'user' ? 'Student Question' : 'Advice Mission AI'}
                    </div>
                    {msg.role === 'user' ? (
                      <p className="text-sm sm:text-[15px] leading-relaxed break-words">
                        {msg.text}
                      </p>
                    ) : (
                      renderFormattedText(msg.text)
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div role="status" aria-live="polite" className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 bg-white border border-slate-200 text-sm text-slate-600">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" aria-hidden="true" />
                  <span>{statusNotice}</span>
                </div>
              </div>
            )}

            {error && (
              <div
                role="status"
                aria-live="polite"
                className="flex justify-start"
              >
                <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 bg-amber-50/80 border border-amber-200/90 text-slate-800 text-sm space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed text-slate-800">{error}</p>
                  </div>
                  {lastFailedQuestion && (
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          void askQuestion(lastFailedQuestion, { reuseLastUserBubble: true })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ask Again</span>
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setInput(lastFailedQuestion);
                          setError(null);
                          inputRef.current?.focus();
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Edit Question</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Direct Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <label htmlFor="advice-ai-input" className="sr-only">
              Type your question or doubt
            </label>
            <input
              ref={inputRef}
              id="advice-ai-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask any topic, math problem, science question, or grammar doubt..."
              className="flex-1 min-w-0 px-4 py-2.5 text-sm sm:text-base bg-[#FAF9F6] border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{loading ? 'Thinking...' : 'Ask Question'}</span>
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
