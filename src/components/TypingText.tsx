import React, { useState, useEffect, useRef } from "react";

// Professional helper to parse message text into high-fidelity formatted layout
export function formatMessageText(text: string) {
  if (!text) return null;

  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const codeLines = part.slice(3, -3).trim().split("\n");
      let language = "code";
      if (
        codeLines[0] &&
        codeLines[0].length < 15 &&
        !codeLines[0].includes(" ") &&
        !codeLines[0].includes("=") &&
        !codeLines[0].includes("(")
      ) {
        language = codeLines[0];
        codeLines.shift();
      }
      const codeText = codeLines.join("\n");

      return (
        <div
          key={index}
          className="my-2 bg-neutral-950/80 rounded-lg p-3 border border-white/10 font-mono text-xs text-violet-200 overflow-x-auto select-text"
        >
          {language && language !== "code" && (
            <div className="text-[9px] text-white/40 uppercase tracking-wider border-b border-white/5 pb-1 mb-1.5 font-bold">
              {language}
            </div>
          )}
          <pre className="whitespace-pre">{codeText}</pre>
        </div>
      );
    }

    // Handle normal text formatting: bold (**) and line breaks
    const subParts = part.split("\n");
    return (
      <div key={index} className="space-y-1 leading-relaxed text-sm">
        {subParts.map((line, lineIdx) => {
          // If bullet point
          const isBullet = line.startsWith("- ") || line.startsWith("* ");
          const contentLine = isBullet ? line.substring(2) : line;

          const boldParts = contentLine.split(/(\*\*.*?\*\*)/g);
          const renderedLine = boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith("**") && bPart.endsWith("**")) {
              return (
                <strong key={bIdx} className="font-semibold text-white">
                  {bPart.slice(2, -2)}
                </strong>
              );
            }
            return bPart;
          });

          if (isBullet) {
            return (
              <ul key={lineIdx} className="list-disc list-inside pl-1.5 text-white/95">
                <li className="inline">{renderedLine}</li>
              </ul>
            );
          }

          return <p key={lineIdx} className="text-white/95">{renderedLine}</p>;
        })}
      </div>
    );
  });
}

interface TypingTextProps {
  text: string;
  isLatest: boolean;
  messageId: string;
}

// Track typed message IDs across mounts to avoid re-triggering the typing animation
// if the user closes and re-opens the chat session drawer
const animatedMessagesSet = new Set<string>();

export default function TypingText({ text, isLatest, messageId }: TypingTextProps) {
  const isAlreadyTyped = animatedMessagesSet.has(messageId);
  const shouldAnimate = isLatest && !isAlreadyTyped;

  const [displayedText, setDisplayedText] = useState(() => {
    return shouldAnimate ? "" : text;
  });

  const indexRef = useRef(0);
  const textRef = useRef(text);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedText(text);
      return;
    }

    indexRef.current = 0;
    setDisplayedText("");

    const tickRate = 12; // speed in ms per chunk
    const totalChars = text.length;
    
    // Dynamic chunking: standard long paragraphs can take 1 second max, but short messages feel animated character-by-character
    const targetDuration = Math.min(1000, Math.max(300, totalChars * 3));
    const totalTicks = targetDuration / tickRate;
    const stepSize = Math.max(1, Math.ceil(totalChars / totalTicks));

    const tick = () => {
      const currentText = textRef.current;
      if (indexRef.current >= currentText.length) {
        setDisplayedText(currentText);
        animatedMessagesSet.add(messageId);
        return;
      }

      indexRef.current += stepSize;
      const nextSlice = currentText.slice(0, indexRef.current);
      setDisplayedText(nextSlice);

      timerRef.current = window.setTimeout(tick, tickRate);
    };

    timerRef.current = window.setTimeout(tick, tickRate);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text, shouldAnimate, messageId]);

  return <>{formatMessageText(displayedText)}</>;
}
