/** The parts of Telegram Desktop's `result.json` that this source reads. Everything is optional
 * because the file comes from the user and is checked field by field when mapped. */
export interface TelegramExport {
  readonly name?: unknown;
  readonly type?: unknown;
  readonly messages?: unknown;
}

export type TelegramTextPart =
  string | { readonly type?: unknown; readonly text?: unknown; readonly user_id?: unknown };

export interface TelegramReaction {
  readonly type?: unknown;
  readonly count?: unknown;
  readonly emoji?: unknown;
  readonly recent?: unknown;
}

export interface TelegramMessage {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly date?: unknown;
  readonly date_unixtime?: unknown;
  readonly from?: unknown;
  readonly from_id?: unknown;
  readonly text?: unknown;
  readonly reply_to_message_id?: unknown;
  readonly media_type?: unknown;
  readonly sticker_emoji?: unknown;
  readonly photo?: unknown;
  readonly file?: unknown;
  readonly poll?: unknown;
  readonly location_information?: unknown;
  readonly contact_information?: unknown;
  readonly reactions?: unknown;
}
