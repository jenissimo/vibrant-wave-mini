import { useCallback, useRef, useState } from 'react';

type Variant = { image: string | null; text: string | null };

export function useGenerationFlow() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<Variant[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const PROGRESS_UPDATE_INTERVAL = 1100;
  const PROGRESS_STEP_MIN = 3;
  const PROGRESS_STEP_MAX = 12;
  const PROGRESS_PAUSE_AT = 90;
  const MIN_SIMULATION_DURATION = 2000;

  const handleGenerate = useCallback(async (args: {
    variantCount: number;
    payload: { prompt: string; canvas: string; attachments: string[] };
    onSingleVariant: (imageUrl: string) => Promise<void>;
  }) => {
    if (isGenerating) return;
    const { variantCount, payload, onSingleVariant } = args;
    setErrorMsg(null);
    setAssistantNote(null);
    setGeneratedVariants(null);
    setIsGenerating(true);
    setGenerationProgress(0);

    const startTime = Date.now();
    let isMinDurationReached = false;
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      isMinDurationReached = elapsed >= MIN_SIMULATION_DURATION;
      setGenerationProgress(prev => {
        if (prev >= PROGRESS_PAUSE_AT) return prev;
        const step = PROGRESS_STEP_MIN + Math.random() * (PROGRESS_STEP_MAX - PROGRESS_STEP_MIN);
        return Math.min(prev + step, PROGRESS_PAUSE_AT);
      });
    }, PROGRESS_UPDATE_INTERVAL);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, variantCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Generation failed');
      setGenerationProgress(100);
      const variants: Variant[] = data?.variants || [];
      const text = data?.text ?? null;
      if (text && String(text).trim().length > 0) setAssistantNote(String(text));
      if (variants.length > 0) {
        if (variants.length === 1) {
          const v = variants[0];
          if (v.image) await onSingleVariant(v.image);
        } else {
          setGeneratedVariants(variants);
        }
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      clearInterval(progressInterval);
      const elapsed = Date.now() - startTime;
      const remainingTime = MIN_SIMULATION_DURATION - elapsed;
      if (remainingTime > 0) {
        setTimeout(() => { setIsGenerating(false); setGenerationProgress(0); }, remainingTime);
      } else {
        setIsGenerating(false);
        setGenerationProgress(0);
      }
    }
  }, [isGenerating]);

  return {
    isGenerating,
    generationProgress,
    assistantNote,
    generatedVariants,
    errorMsg,
    setAssistantNote,
    setGeneratedVariants,
    setErrorMsg,
    handleGenerate,
  } as const;
}


