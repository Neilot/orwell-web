export const es = {
  app: {
    title: 'Orwell',
    tagline: 'Estadísticas de tu grupo de Telegram. El archivo no sale de tu equipo.',
  },
} as const;

/** Shape every locale must follow. */
export type Messages = typeof es;
