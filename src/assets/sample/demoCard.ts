import { Card } from '@/lib/types';

const nowIso = () => new Date().toISOString();

export function makeDemoCard(cardId = 'card_demo_emoji'): Card {
  return {
    schemaVersion: 'CJ-0.1',
    cardId,
    name: 'Emoji Cannon (Demo)',
    description: 'Hover the preview target to launch a ridiculous emoji across the screen.',
    tags: ['demo', 'ui', 'listener'],
    actions: [
      {
        actionId: 'action_hover_emoji',
        name: 'Hover Emoji Blast',
        graphId: 'graph_demo_hover_emoji'
      }
    ],
    meta: { createdAt: nowIso(), updatedAt: nowIso() }
  };
}
