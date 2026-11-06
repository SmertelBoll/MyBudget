import { useEffect, useState } from "react";

// False on the first render, true a frame later. Long forms draw what's on screen first and the parts below the fold
// right after, so opening the screen isn't held up by fields nobody sees yet.
export const useAfterFirstFrame = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Whichever comes first: the next frame, or a short timer (frames stop while the app is in the background).
    const frame = requestAnimationFrame(() => setReady(true));
    const timer = setTimeout(() => setReady(true), 50);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);
  return ready;
};
