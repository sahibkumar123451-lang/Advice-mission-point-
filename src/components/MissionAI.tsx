import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Edit3,
  Loader2,
  MessageSquareText,
  RotateCcw,
  SendHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  formatFriendlyAiError,
  retryWithExponentialBackoff,
} from '../utils/coachingLogic';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  failedQuestion?: string;
}

type LanguagePreference = 'bilingual' | 'english' | 'hindi';

interface MissionAIProps {
  coachingName: string;
  externalPrompt?: { text: string; id: number } | null;
  onExternalPromptConsumed?: () => void;
  focusTrigger?: number;
}

const STARTER_QUESTIONS = [
  {
    label: 'About Coaching & Mission AI',
    prompt: 'Who is the owner of Advice Mission Point and what can Mission AI help me with?',
  },
  {
    label: 'Physics Doubt',
    prompt: "Explain Newton's Second Law (F = ma) with a simple daily life example in Hindi and English.",
  },
  {
    label: 'Maths Steps',
    prompt: 'How do I solve quadratic equations using the quadratic formula step by step?',
  },
  {
    label: 'English Grammar',
    prompt: 'Explain the difference between Active Voice and Passive Voice with 2 easy examples.',
  },
];

function createWelcomeMessage(coachingName: string): ChatMessage {
  return {
    id: 'mission-ai-welcome',
    role: 'assistant',
    text: `नमस्ते!\nI am **Mission AI** for **${coachingName}** (Owner: **Surendra Sir**). Ask any study doubt or coaching question.`,
  };
}

function cleanMathFormatting(line: string): string {
  return line.replace(/\$([^$]+)\$/g, '$1');
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((rawLine, lineIdx) => {
    const line = cleanMathFormatting(rawLine);
    const segments = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lineIdx} className="block min-h-[1.25rem]">
        {segments.map((seg, segIdx) => {
          if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
            return (
              <strong key={segIdx} className="font-semibold text-slate-950">
                {seg.slice(2, -2)}
              </strong>
            );
          }
          return <span key={segIdx}>{seg}</span>;
        })}
      </span>
    );
  });
}

function isRetryableClientHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function shouldRetryClientFetchError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return false;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('api_key_invalid') || msg.includes('403') || msg.includes('400')) {
    return false;
  }
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('504') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('empty') ||
    msg.includes('html')
  );
}

export function MissionAI({
  coachingName,
  externalPrompt,
  onExternalPromptConsumed,
  focusTrigger,
}: MissionAIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(coachingName),
  ]);
  const [input, setInput] = useState('');
  const [languagePreference, setLanguagePreference] =
    useState<LanguagePreference>('bilingual');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [lastSubmittedQuestion, setLastSubmittedQuestion] = useState('');

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  // Focus input smoothly when navbar/hero triggers Mission AI
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [focusTrigger]);

  // Keep welcome message synced if coaching name loads asynchronously and chat is fresh
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'mission-ai-welcome') {
        return [createWelcomeMessage(coachingName)];
      }
      return prev;
    });
  }, [coachingName]);

  // Auto-scroll chat feed softly when new messages or deltas arrive
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming, statusNotice]);

  // Abort any pending stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const askMissionAi = useCallback(
    async (
      rawQuestion: string,
      options?: {
        replaceMessageId?: string;
        omitUserAppend?: boolean;
        interruptActive?: boolean;
      },
    ) => {
      const trimmed = rawQuestion.trim();
      if (!trimmed) {
        return;
      }
      if (sendingRef.current) {
        if (!options?.interruptActive) {
          return;
        }
        abortControllerRef.current?.abort();
        sendingRef.current = false;
      }

      sendingRef.current = true;
      setIsStreaming(true);
      setStatusNotice(null);
      setLastSubmittedQuestion(trimmed);

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now() + 1}`;

      const currentSnapshot = messagesRef.current.filter(
        (m) => m.id === 'mission-ai-welcome' || m.isError || m.text.trim().length > 0,
      );
      const cleanedBase = options?.replaceMessageId
        ? currentSnapshot.filter((m) => m.id !== options.replaceMessageId)
        : currentSnapshot;

      const withoutErrors = cleanedBase.filter(
        (m) => !m.isError && m.id !== 'mission-ai-welcome' && m.text.trim().length > 0,
      );

      const hasSameTrailingUser =
        options?.omitUserAppend &&
        withoutErrors.length > 0 &&
        withoutErrors[withoutErrors.length - 1].role === 'user' &&
        withoutErrors[withoutErrors.length - 1].text.trim() === trimmed;

      const conversationPayload: Array<{ role: 'user' | 'assistant'; text: string }> =
        hasSameTrailingUser
          ? withoutErrors.map((m) => ({ role: m.role, text: m.text }))
          : [
              ...withoutErrors.map((m) => ({ role: m.role, text: m.text })),
              { role: 'user' as const, text: trimmed },
            ];

      const nextMessages: ChatMessage[] = hasSameTrailingUser
        ? [...cleanedBase.filter((m) => !m.isError)]
        : [
            ...cleanedBase.filter((m) => !m.isError),
            { id: userMsgId, role: 'user', text: trimmed },
          ];

      const updatedWithPending = [
        ...nextMessages,
        { id: assistantMsgId, role: 'assistant' as const, text: '' },
      ];
      messagesRef.current = updatedWithPending;
      setMessages(updatedWithPending);

      if (!options?.omitUserAppend) {
        setInput('');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let receivedDelta = false;
      const slowConnectionTimer = setTimeout(() => {
        if (!receivedDelta && !controller.signal.aborted) {
          setStatusNotice(
            'Taking a brief moment to prepare a clear answer — please stay with us...',
          );
        }
      }, 2500);

      try {
        await retryWithExponentialBackoff(
          async () => {
            if (controller.signal.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }

            const response = await fetch('/api/mission-ai/stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: conversationPayload,
                languagePreference,
              }),
              signal: controller.signal,
            });

            const contentType = (response.headers.get('content-type') || '').toLowerCase();

            if (!response.ok || contentType.includes('text/html')) {
              let errText = `Request failed (${response.status})`;
              if (contentType.includes('application/json')) {
                try {
                  const errJson = (await response.json()) as { error?: string };
                  if (errJson.error) errText = errJson.error;
                } catch {
                  // Ignore JSON parse error
                }
              }
              if (isRetryableClientHttpStatus(response.status) || contentType.includes('text/html')) {
                throw new Error(errText);
              }
              throw new Error(errText);
            }

            if (contentType.includes('application/json')) {
              const json = (await response.json()) as { answer?: string; error?: string };
              if (json.error) {
                throw new Error(json.error);
              }
              if (!json.answer?.trim()) {
                throw new Error('Empty model response');
              }
              receivedDelta = true;
              setStatusNotice(null);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, text: json.answer! } : m,
                ),
              );
              return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('Streaming unavailable');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let accumulated = '';
            let streamErrorMessage = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const events = buffer.split('\n\n');
              buffer = events.pop() ?? '';

              for (const rawEvent of events) {
                const dataLine = rawEvent
                  .split('\n')
                  .find((line) => line.startsWith('data:'));
                if (!dataLine) continue;

                const jsonRaw = dataLine.slice(5).trim();
                if (!jsonRaw) continue;

                try {
                  const payload = JSON.parse(jsonRaw) as {
                    delta?: string;
                    status?: string;
                    message?: string;
                    done?: boolean;
                    error?: string;
                  };

                  if (payload.status && payload.message && !receivedDelta) {
                    setStatusNotice(payload.message);
                  }

                  if (payload.delta) {
                    if (!receivedDelta) {
                      receivedDelta = true;
                      setStatusNotice(null);
                    }
                    accumulated += payload.delta;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId ? { ...m, text: accumulated } : m,
                      ),
                    );
                  }

                  if (payload.error && !accumulated) {
                    streamErrorMessage = payload.error;
                  }
                } catch {
                  // Ignore partial JSON frames
                }
              }
            }

            if (!accumulated.trim()) {
              throw new Error(streamErrorMessage || 'Empty model response');
            }
          },
          {
            maxRetries: 2,
            baseDelayMs: 400,
            maxDelayMs: 1600,
            shouldRetry: (err) => !receivedDelta && shouldRetryClientFetchError(err),
            onRetry: (attempt) => {
              if (!receivedDelta) {
                setStatusNotice(
                  attempt === 1
                    ? 'Connecting with backup AI route for your answer...'
                    : 'Still connecting gently — thank you for waiting...',
                );
              }
            },
          },
        );
      } catch (streamErr) {
        if (controller.signal.aborted) {
          return;
        }

        // Fallback to non-streaming /api/mission-ai/ask if streaming didn't emit any text
        let fallbackErrorMessage = '';
        if (!receivedDelta) {
          try {
            setStatusNotice('Completing your reply via direct mode...');
            const askRes = await fetch('/api/mission-ai/ask', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: conversationPayload,
                languagePreference,
              }),
              signal: controller.signal,
            });
            const askType = (askRes.headers.get('content-type') || '').toLowerCase();
            if (askType.includes('application/json')) {
              const data = (await askRes.json()) as { answer?: string; error?: string };
              if (askRes.ok && data.answer?.trim()) {
                receivedDelta = true;
                setStatusNotice(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, text: data.answer! } : m,
                  ),
                );
                return;
              }
              if (data.error) {
                fallbackErrorMessage = data.error;
              }
            }
          } catch {
            // Fall through to clean inline Ask Again message below
          }
        }

        const rawMsg =
          fallbackErrorMessage ||
          (streamErr instanceof Error ? streamErr.message : String(streamErr ?? ''));
        const friendly = formatFriendlyAiError(rawMsg);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: friendly,
                  isError: true,
                  failedQuestion: trimmed,
                }
              : m,
          ),
        );
      } finally {
        clearTimeout(slowConnectionTimer);
        if (abortControllerRef.current === controller) {
          setStatusNotice(null);
          setIsStreaming(false);
          sendingRef.current = false;
        }
      }
    },
    [languagePreference],
  );

  // Trigger external prompt passed from Learning Hub cards/modal
  useEffect(() => {
    if (externalPrompt && externalPrompt.text.trim()) {
      const promptText = externalPrompt.text;
      onExternalPromptConsumed?.();
      void askMissionAi(promptText, { interruptActive: true });
    }
  }, [externalPrompt, onExternalPromptConsumed, askMissionAi]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askMissionAi(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void askMissionAi(input);
    }
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    sendingRef.current = false;
    setIsStreaming(false);
    setStatusNotice(null);
    setInput('');
    setMessages([createWelcomeMessage(coachingName)]);
    inputRef.current?.focus();
  };

  return (
    <section
      id="mission-ai"
      aria-labelledby="mission-ai-heading"
      className="py-16 lg:py-24 bg-[#FAF9F6] border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Intro & Starter Prompts */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Official Study &amp; Coaching Assistant</span>
            </div>

            <h2
              id="mission-ai-heading"
              className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance"
            >
              Mission AI
            </h2>

            <p className="mt-2 text-sm font-semibold text-slate-700">
              Official AI Assistant of {coachingName} · Guided by Surendra Sir
            </p>

            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Get fast, step-by-step explanations for Class 1 to 12 Mathematics, Science, English, and Social Studies, or ask about our batches, timings, and notes in Hindi or English.
            </p>

            {/* Quick Starter Questions */}
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Try a Question
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                {STARTER_QUESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => void askMissionAi(item.prompt)}
                    className="text-left p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-amber-800">{item.label}</div>
                    <div className="mt-0.5 text-sm text-slate-700 line-clamp-2">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Interactive Chat Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Top Bar */}
              <div className="px-5 py-4 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <MessageSquareText className="w-4 h-4 text-amber-300" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-tight">Mission AI</div>
                    <div className="text-xs text-slate-300">
                      {coachingName} · Surendra Sir
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-label="Response language preference"
                    className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800"
                  >
                    {(
                      [
                        { id: 'bilingual', label: 'Hindi + Eng' },
                        { id: 'english', label: 'English' },
                        { id: 'hindi', label: 'हिन्दी' },
                      ] as const
                    ).map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setLanguagePreference(lang.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          languagePreference === lang.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>New Chat</span>
                  </button>
                </div>
              </div>

              {/* Conversation Thread */}
              <div
                ref={messagesContainerRef}
                aria-live="polite"
                className="h-[380px] sm:h-[420px] overflow-y-auto p-5 space-y-4 bg-[#FAF9F6]/60"
              >
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isEmptyStreamingBubble =
                    !isUser && !msg.text && isStreaming && !msg.isError;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-br-sm'
                            : msg.isError
                              ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-bl-sm'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-2xs'
                        }`}
                      >
                        {!isUser && (
                          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1">
                            Mission AI
                          </div>
                        )}

                        {isEmptyStreamingBubble ? (
                          <div className="flex items-center gap-2 text-slate-500 py-1">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-700" aria-hidden="true" />
                            <span>Thinking through your question...</span>
                          </div>
                        ) : isUser ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <div className="space-y-1">{renderFormattedText(msg.text)}</div>
                        )}

                        {msg.isError && msg.failedQuestion && (
                          <div className="mt-3 pt-2.5 border-t border-amber-200/80 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isStreaming}
                              onClick={() =>
                                void askMissionAi(msg.failedQuestion!, {
                                  replaceMessageId: msg.id,
                                  omitUserAppend: true,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ask Again</span>
                            </button>
                            <button
                              type="button"
                              disabled={isStreaming}
                              onClick={() => {
                                setInput(msg.failedQuestion || lastSubmittedQuestion);
                                inputRef.current?.focus();
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit Question</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calm non-blocking status bar when switching models or warming up */}
              {statusNotice && (
                <div
                  role="status"
                  className="px-5 py-2 bg-amber-50 border-t border-amber-200 text-xs font-medium text-amber-900 flex items-center gap-2"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                  <span>{statusNotice}</span>
                </div>
              )}

              {/* Question Input Form */}
              <form
                onSubmit={handleSubmit}
                className="p-4 bg-white border-t border-slate-200"
              >
                <label htmlFor="mission-ai-input" className="sr-only">
                  Ask Mission AI a question
                </label>
                <div className="flex items-end gap-2.5">
                  <textarea
                    id="mission-ai-input"
                    ref={inputRef}
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask any Maths, Science, English, or coaching question..."
                    className="flex-1 resize-none rounded-xl border border-slate-300 bg-[#FAF9F6] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isStreaming || !input.trim()}
                    aria-label="Send question to Mission AI"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <SendHorizontal className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {isStreaming ? 'Answering...' : 'Ask'}
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Press Enter to send · Shift+Enter for a new line
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
