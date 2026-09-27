import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { socketUrl } from '../api/client';
import type { AssistantMessageMeta } from '../api/refunds';
import type { RefundMessage } from '../api/types';

interface Ack {
  ok: boolean;
  error?: string;
  requestId?: string;
  message?: RefundMessage;
  aiReply?: RefundMessage | null;
}

export interface IncomingRefundEvent {
  requestId: string;
  message: RefundMessage;
  aiReply?: RefundMessage | null;
}


export function useRefundSocket(options: {
  requestId: string | null;
  onMessage?: (event: IncomingRefundEvent) => void;
  onQueueActivity?: (requestId: string, message?: RefundMessage) => void;
}) {
  const { requestId, onMessage, onQueueActivity } = options;
  const [connected, setConnected] = useState(false);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);


  const ready = connected && requestId !== null && joinedId === requestId;

  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;
  const queueHandler = useRef(onQueueActivity);
  queueHandler.current = onQueueActivity;

  useEffect(() => {
    const socket = io(socketUrl(), {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('refund:message', (event: IncomingRefundEvent) => messageHandler.current?.(event));
    socket.on('refund:activity', (event: { requestId: string; message?: RefundMessage }) =>
      queueHandler.current?.(event.requestId, event.message),
    );

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let active = true;
    setJoinedId(null);

    const join = (id: string) =>
      socket.emit('refund:join', { requestId: id }, (ack?: { ok?: boolean; requestId?: string }) => {
        if (active && ack?.ok && ack.requestId === id) setJoinedId(id);
      });

    if (requestId) {
      if (socket.connected) join(requestId);
      else socket.once('connect', () => join(requestId));
    }

    return () => {
      active = false;
      if (requestId) socket.emit('refund:leave', { requestId });
    };
  }, [requestId]);

  const send = useCallback(
    (body: string, clientId: string): Promise<Ack> => {
      const socket = socketRef.current;
      if (!socket || !requestId) return Promise.reject(new Error('Chat is not connected yet'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The reply timed out. Please try again.')), 15000);
        socket.emit('refund:message', { requestId, body, clientId }, (ack: Ack) => {
          clearTimeout(timer);
          if (ack?.ok) resolve(ack);
          else reject(new Error(ack?.error === 'FORBIDDEN' ? 'You cannot post in this thread.' : 'Message failed to send.'));
        });
      });
    },
    [requestId],
  );


  const sendAi = useCallback(
    (body: string, meta: AssistantMessageMeta, clientId: string): Promise<Ack> => {
      const socket = socketRef.current;
      if (!socket || !requestId) return Promise.reject(new Error('Chat is not connected yet'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Saving the reply timed out.')), 15000);
        socket.emit('refund:ai_message', { requestId, body, meta, clientId }, (ack: Ack) => {
          clearTimeout(timer);
          if (ack?.ok) resolve(ack);
          else reject(new Error(ack?.error === 'FORBIDDEN' ? 'You cannot post in this thread.' : 'Could not save the reply.'));
        });
      });
    },
    [requestId],
  );

  return { connected, ready, send, sendAi };
}
