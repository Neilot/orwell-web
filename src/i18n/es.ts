const HOW_TO_EXPORT =
  'En Telegram Desktop: abre el chat, pulsa ⋮ → Exportar historial del chat, desmarca fotos y videos y elige el formato «JSON legible por máquina».';

export const es = {
  app: {
    title: 'Orwell',
    tagline: 'Estadísticas de tu grupo de Telegram. El archivo no sale de tu equipo.',
  },
  dates: {
    months: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    /** Monday first. */
    weekdays: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    weekdayInitials: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  },
  header: {
    defaultGroupName: 'Grupo de Telegram',
    month: 'Mes',
    monthOption: (month: string, year: string) => `${month} ${year}`,
    monthsInFile: (count: string) => `${count} meses en el archivo`,
    subtitle: (month: string, year: string, participants: string) =>
      `${month} de ${year} · ${participants} participantes`,
    partialMonth: (day: string) => ` · datos hasta el día ${day}`,
  },
  empty: {
    title: 'Tu grupo de Telegram',
    subtitle: 'Sube la exportación del chat para ver su actividad.',
    heading: 'Todavía no hay ningún chat',
    body: 'Pulsa «Analizar mi chat» y elige el archivo JSON (normalmente result.json) que guarda Telegram Desktop al exportar el historial del grupo en formato JSON, o un .zip de la carpeta de la exportación.',
  },
  upload: {
    pick: 'Analizar mi chat',
    backToDemo: 'Volver al ejemplo',
    hintBefore: 'Sube el ',
    hintFile: 'result.json',
    hintAfter:
      ' o el .zip que exporta Telegram Desktop. El archivo se procesa en tu navegador y no se envía a ningún servidor.',
    reading: (name: string) => `Leyendo ${name}…`,
    showing: (name: string, months: number, messages: string) =>
      `Mostrando ${name}: ${String(months)} ${months === 1 ? 'mes' : 'meses'}, ${messages} mensajes en total.`,
    noMessages: 'El archivo no tiene ningún mensaje que analizar.',
    skipped: (count: number, formatted: string) =>
      ` Se omitieron ${formatted} ${count === 1 ? 'mensaje no válido' : 'mensajes no válidos'}.`,
  },
  errors: {
    'unsupported-file': `Ese tipo de archivo no se puede leer. Sube el archivo JSON de la exportación (se llame como se llame) o un .zip con su carpeta. ${HOW_TO_EXPORT}`,
    'invalid-export': `El archivo no es un JSON válido o no es la exportación de un chat de Telegram. ${HOW_TO_EXPORT}`,
    'invalid-archive':
      'No se pudo abrir el .zip: puede estar dañado o incompleto. Vuelve a comprimir la carpeta de la exportación o sube directamente el archivo JSON que hay dentro.',
    'export-not-found': `El .zip no contiene ninguna exportación en JSON. Comprime la carpeta que crea Telegram Desktop al exportar (la que empieza por «ChatExport»). ${HOW_TO_EXPORT}`,
    'wrong-export-format': `Esa es la exportación en HTML, que no se puede analizar. Vuelve a exportar el chat en formato JSON. ${HOW_TO_EXPORT}`,
    'account-export': `Ese archivo es la exportación de toda la cuenta, no la de un chat. Exporta solo el grupo que quieres ver. ${HOW_TO_EXPORT}`,
    'unsupported-chat-type':
      'Ese archivo es la exportación de un canal. Por ahora solo se pueden analizar grupos y chats.',
    'empty-chat':
      'La exportación no tiene ningún mensaje. Comprueba que exportaste el chat correcto y el periodo de fechas que querías.',
    'too-large': `El archivo es demasiado grande para analizarlo en el navegador. Exporta un periodo más corto. ${HOW_TO_EXPORT}`,
    unknown: 'No se ha podido analizar el archivo.',
  },
  people: {
    deletedAccount: 'Cuenta eliminada',
  },
  daily: {
    title: 'Mensajes por día del mes',
    legendBars: 'Mensajes por día',
    legendAverage: 'Promedio de 7 días',
    chartLabel: 'Mensajes por día',
    weekendNote: 'Fondo gris: fin de semana',
    record: (count: string, weekday: string, day: string) =>
      `Récord: ${count} el ${weekday} ${day}`,
    tipTitle: (weekday: string, day: string, month: string) => `${weekday} ${day} de ${month}`,
    tipMessages: 'Mensajes',
    tipAverage: 'Promedio 7 días',
    noValue: '—',
  },
};

/** Shape every locale must follow. */
export type Messages = typeof es;
