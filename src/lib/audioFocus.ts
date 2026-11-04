/**
 * Only one audio note may play at a time. Every player registers the element it is about to
 * play here; the previously playing one is paused (its own `pause` listener resets its UI).
 */
let current: HTMLAudioElement | null = null;

export function playExclusive(audio: HTMLAudioElement): Promise<void> {
  if (current && current !== audio) current.pause();
  current = audio;
  return audio.play();
}
