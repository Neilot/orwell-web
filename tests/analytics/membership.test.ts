import { describe, expect, it } from 'vitest';
import { Membership } from '../../src/analytics/membership';
import type { ChatEvent, MembershipChange, Participant } from '../../src/core/chat-event';
import { chatEvent } from '../helpers';

const ana: Participant = { id: 'u1', displayName: 'Ana' };
const carla: Participant = { id: 'u3', displayName: 'Carla' };
const dani: Participant = { id: 'u4', displayName: 'Dani' };

function notice(author: Participant, day: number, membership: MembershipChange): ChatEvent {
  return chatEvent({
    author,
    kind: 'service',
    text: '',
    localTime: `2026-08-${String(day).padStart(2, '0')}T21:00:00`,
    membership,
  });
}

describe('Membership', () => {
  it('lists joins and leaves per person, matching names to the accounts that write', () => {
    const analyzer = new Membership();
    analyzer.consume(chatEvent({ author: ana }));
    analyzer.consume(
      notice(carla, 4, { change: 'join', via: 'link', who: [{ id: 'u3', name: 'Carla' }] }),
    );
    analyzer.consume(notice(ana, 6, { change: 'join', via: 'added', who: [{ name: 'Dani' }] }));
    analyzer.consume(chatEvent({ author: carla }));
    analyzer.consume(chatEvent({ author: dani }));
    analyzer.consume(notice(carla, 20, { change: 'leave', who: [{ name: 'Carla' }] }));
    analyzer.consume(notice(ana, 25, { change: 'leave', who: [{ name: 'Dani' }] }));
    analyzer.consume(
      notice(carla, 27, { change: 'join', via: 'link', who: [{ id: 'u3', name: 'Carla' }] }),
    );
    analyzer.consume(notice(ana, 28, { change: 'join', via: 'added', who: [{ name: 'Nadie' }] }));
    expect(analyzer.result()).toEqual({
      u3: [
        { day: '2026-08-04', name: 'Carla', type: 'join', via: 'link', by: null },
        { day: '2026-08-20', name: 'Carla', type: 'leave', removed: false, by: null },
        { day: '2026-08-27', name: 'Carla', type: 'join', via: 'link', by: null },
      ],
      u4: [
        { day: '2026-08-06', name: 'Dani', type: 'join', via: 'invited', by: 'Ana' },
        { day: '2026-08-25', name: 'Dani', type: 'leave', removed: true, by: 'Ana' },
      ],
      // Someone who never writes keeps an id made from their name.
      'name:Nadie': [{ day: '2026-08-28', name: 'Nadie', type: 'join', via: 'invited', by: 'Ana' }],
    });
  });

  it('tells adding yourself from being added', () => {
    const analyzer = new Membership();
    analyzer.consume(chatEvent({ author: ana }));
    analyzer.consume(notice(ana, 3, { change: 'join', via: 'added', who: [{ name: 'Ana' }] }));
    expect(analyzer.result()).toEqual({
      u1: [{ day: '2026-08-03', name: 'Ana', type: 'join', via: 'self', by: null }],
    });
  });
});
