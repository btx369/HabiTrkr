/**
 * Reads the length of an audio file without playing it, so players can show the total time
 * straight away instead of 0:00 until the first play.
 *
 * Recordings made in the browser (MediaRecorder) often report `Infinity` as their duration
 * until the end has been reached once; seeking far past the end makes the browser compute
 * the real value, so that is done here, then the element is thrown away.
 */
const cache = new Map<string, Promise<number>>();

export function readAudioDuration(url: string): Promise<number> {
  const hit = cache.get(url);
  if (hit) return hit;
  const promise = new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const finish = (value: number) => {
      audio.removeAttribute('src');
      audio.load();
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };
    audio.addEventListener('error', () => finish(0), { once: true });
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) { finish(audio.duration); return; }
      audio.addEventListener('timeupdate', () => finish(audio.duration), { once: true });
      audio.currentTime = 1e101;
    }, { once: true });
    audio.src = url;
  });
  cache.set(url, promise);
  return promise;
}
