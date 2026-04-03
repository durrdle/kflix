'use client';

import { useEffect } from 'react';

const INTRO_TITLE = 'KFLIX';
const MARQUEE_TEXT = 'Watch Movies, Shows & Sports';
const INTRO_DURATION_MS = 10000;
const STEP_MS = 180;
const VIEWPORT_WIDTH = 28;

function buildFrames(text, width) {
  const spacer = ' '.repeat(width);
  const source = `${spacer}${text}${spacer}`;
  const frames = [];

  for (let i = 0; i <= source.length - width; i += 1) {
    frames.push(source.slice(i, i + width));
  }

  return frames;
}

export default function AnimatedTabTitle() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const frames = buildFrames(MARQUEE_TEXT, VIEWPORT_WIDTH);

    let introTimeout = null;
    let marqueeInterval = null;

    const clearTimers = () => {
      if (introTimeout) {
        clearTimeout(introTimeout);
        introTimeout = null;
      }

      if (marqueeInterval) {
        clearInterval(marqueeInterval);
        marqueeInterval = null;
      }
    };

    const startSequence = () => {
      clearTimers();
      document.title = INTRO_TITLE;

      introTimeout = window.setTimeout(() => {
        let index = 0;
        document.title = frames[index];

        marqueeInterval = window.setInterval(() => {
          index = (index + 1) % frames.length;
          document.title = frames[index];
        }, STEP_MS);
      }, INTRO_DURATION_MS);
    };

    startSequence();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        startSequence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}