import type { TopicView } from '../../app';
import type { Messages } from '../../i18n';

/** One colour per named topic, in the order the topics are shown. */
const TOPIC_COLORS = ['--k0', '--k2', '--k1', '--k4', '--k5', '--k3', '--k7'];

/** The colour of each slice: grey for the chat outside topics and for the quieter topics. */
export function topicColors(topics: readonly TopicView[]): Map<TopicView, string> {
  let next = 0;
  return new Map(
    topics.map((topic) => [
      topic,
      topic.kind === 'general'
        ? 'var(--c5)'
        : topic.kind === 'others'
          ? 'var(--edge)'
          : `var(${TOPIC_COLORS[next++ % TOPIC_COLORS.length] ?? '--k0'})`,
    ]),
  );
}

/** The name to show for a slice. */
export function topicName(topic: TopicView, t: Messages): string {
  return topic.kind === 'general'
    ? t.topics.general
    : topic.kind === 'others'
      ? t.topics.others
      : (topic.title ?? '');
}
