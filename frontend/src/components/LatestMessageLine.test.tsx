import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LatestMessageLine } from './LatestMessageLine';
import type { RefundRequest } from '../api/types';

function request(overrides: Partial<RefundRequest> = {}): RefundRequest {
  return {
    lastMessage: {
      author: 'CUSTOMER',
      body: 'the item arrived broken',
      createdAt: '2026-03-04T10:00:00.000Z',
    },
    unreadCount: 0,
    ...overrides,
  } as RefundRequest;
}

describe('LatestMessageLine attribution', () => {
 
  it('labels the customer as "You" for the customer', () => {
    render(<LatestMessageLine request={request()} viewerRole="CUSTOMER" />);
    expect(screen.getByText('You:')).toBeInTheDocument();
  });

  it('labels the customer as "Customer" for an admin', () => {
    render(<LatestMessageLine request={request()} viewerRole="ADMIN" />);
    expect(screen.getByText('Customer:')).toBeInTheDocument();
    expect(screen.queryByText('You:')).not.toBeInTheDocument();
  });

  it('prefers the real support agent name when one is known', () => {
    render(
      <LatestMessageLine
        request={request({
          lastMessage: {
            author: 'ADMIN',
            authorName: 'Priya',
            body: 'I have issued the replacement',
            createdAt: '2026-03-04T10:00:00.000Z',
          },
        })}
        viewerRole="CUSTOMER"
      />,
    );
    expect(screen.getByText('Priya:')).toBeInTheDocument();
  });

  it('falls back to a generic label for an admin reply with no name', () => {
    render(
      <LatestMessageLine
        request={request({
          lastMessage: {
            author: 'ADMIN',
            body: 'On it',
            createdAt: '2026-03-04T10:00:00.000Z',
          },
        })}
        viewerRole="CUSTOMER"
      />,
    );
    expect(screen.getByText('Support:')).toBeInTheDocument();
  });
});

describe('LatestMessageLine unread badge', () => {
  
  it('renders the badge by default', () => {
    render(<LatestMessageLine request={request({ unreadCount: 3 })} viewerRole="CUSTOMER" />);
    expect(screen.getByLabelText('3 unread messages')).toBeInTheDocument();
  });

  it('omits the badge when the row already renders one', () => {
    render(
      <LatestMessageLine request={request({ unreadCount: 3 })} viewerRole="CUSTOMER" showBadge={false} />,
    );
    expect(screen.queryByLabelText('3 unread messages')).not.toBeInTheDocument();
  });

  it('renders nothing when the request has no messages yet', () => {
    const { container } = render(
      <LatestMessageLine request={request({ lastMessage: undefined })} viewerRole="CUSTOMER" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
