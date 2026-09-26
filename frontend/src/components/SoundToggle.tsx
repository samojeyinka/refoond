import { BellOff, BellRing } from 'lucide-react';
import { useCallback, useState } from 'react';
import { chatSound } from '../lib/sound';
import { cn } from '../lib/cn';

/**
 * Mute control for chat notification sounds. Lives in the chat header so the
 * sound is never something a user has to hunt for to turn off.
 */
export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMuted] = useState(() => chatSound.isMuted());

  const toggle = useCallback(() => {
    setMuted(chatSound.toggle());
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute chat sounds' : 'Mute chat sounds'}
      title={muted ? 'Chat sounds are off' : 'Chat sounds are on'}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        className,
      )}
    >
      {muted ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
    </button>
  );
}
