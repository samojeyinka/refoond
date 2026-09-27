import { useEffect, useId } from 'react';
import { toast } from 'react-toastify';

export function FormErrorBanner({ message }: { message: string | null }) {
  const toastId = useId();

  useEffect(() => {
    if (!message) return;
    toast.error(message, { toastId });
    return () => toast.dismiss(toastId);
  }, [message, toastId]);

  return null;
}
