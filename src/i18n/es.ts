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
    body: 'Pulsa «Analizar mi chat» y elige el result.json que guarda Telegram Desktop al exportar el historial del grupo en formato JSON.',
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
  },
  errors: {
    'unsupported-file':
      'Por ahora solo se puede leer el result.json (en formato JSON) que exporta Telegram Desktop.',
    'invalid-export':
      'Ese archivo no parece una exportación de Telegram: no es JSON o no tiene la lista de mensajes.',
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
