import type { PersonView } from '../app';
import type { Messages } from '../i18n';

/** Name to show for a person; deleted accounts have none in the export. */
export function personName(person: PersonView, t: Messages): string {
  return person.name ?? t.people.deletedAccount;
}
