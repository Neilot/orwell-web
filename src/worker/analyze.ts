// The one place where sources and analyzers are wired together.
import {
  Conversations,
  Interactions,
  LinkSharing,
  Membership,
  MessageLengths,
  MessagesPerDay,
  PeopleActivity,
  PersonHabitsAnalyzer,
  ResponseTimes,
  StarMessages,
  StickerUsage,
  Vocabulary,
  WeeklyRhythm,
  WeeklyWords,
} from '../analytics';
import type { Dashboard } from '../app';
import { AnalysisPipeline, SourceRegistry, type Analyzer, type InputFile } from '../core';
import { TelegramSource } from '../sources/telegram';

const registry = new SourceRegistry([new TelegramSource()]);

// Reads with a reader rather than `for await` over the stream, which Safari does not support.
async function* streamChunks(file: File): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function inputFile(file: File): InputFile {
  return {
    name: file.name,
    size: file.size,
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
    chunks: () => streamChunks(file),
  };
}

async function analyze(file: InputFile): Promise<Dashboard> {
  const source = await registry.find(file);
  const perDay = new MessagesPerDay();
  const people = new PeopleActivity();
  const interactions = new Interactions();
  const rhythm = new WeeklyRhythm();
  const responseTimes = new ResponseTimes();
  const habits = new PersonHabitsAnalyzer();
  const vocabulary = new Vocabulary();
  const stickers = new StickerUsage();
  const membership = new Membership();
  const links = new LinkSharing();
  const stars = new StarMessages();
  const conversations = new Conversations();
  const lengths = new MessageLengths();
  const weeklyWords = new WeeklyWords();
  const report = await new AnalysisPipeline([
    perDay,
    people,
    interactions,
    rhythm,
    responseTimes,
    habits,
    vocabulary,
    stickers,
    membership,
    links,
    stars,
    conversations,
    lengths,
    weeklyWords,
  ]).run(source, file);
  // The pipeline stores each result under its analyzer's id; this reads it back typed.
  const resultOf = <T>(analyzer: Analyzer<T>): T => report.results[analyzer.id] as T;
  return {
    title: report.chat.title,
    messageCount: report.eventCount,
    skippedMessages: report.chat.skippedEntries,
    messagesPerDay: resultOf(perDay),
    peoplePerMonth: resultOf(people),
    interactionsPerMonth: resultOf(interactions),
    rhythmPerMonth: resultOf(rhythm),
    responseTimesPerMonth: resultOf(responseTimes),
    habitsPerMonth: resultOf(habits),
    vocabularyPerMonth: resultOf(vocabulary),
    stickersPerMonth: resultOf(stickers),
    membership: resultOf(membership),
    linksPerMonth: resultOf(links),
    starsPerMonth: resultOf(stars),
    conversationsPerMonth: resultOf(conversations),
    messageLengthsPerMonth: resultOf(lengths),
    weeklyWordsPerMonth: resultOf(weeklyWords),
  };
}

export function analyzeFile(file: File): Promise<Dashboard> {
  return analyze(inputFile(file));
}
