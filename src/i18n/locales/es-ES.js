// Spanish (Spain) regional overrides, merged over es.js
/**
 * Spanish — Spain / peninsular (es-ES) overrides.
 * Machine-translated draft, pending native review.
 *
 * Only keys whose wording genuinely diverges from neutral es.js for peninsular
 * Spanish (vocabulary, tone). Merged OVER es.js; everything else falls back.
 * Interpolation tokens ({slug} {name} {zones} {mins} {v}) and HTML markup are
 * preserved verbatim.
 *
 * Peninsular divergences captured:
 *  - "anótate" → "apúntate" (idiomatic CTA for claiming a slot in Spain).
 *  - "boleto" → "billete" (a transport ticket is a "billete" in Spain).
 *  - "ingresar" (data-entry Latin-Americanism) → "introducir".
 *  - "en vivo" → "en directo" (the peninsular norm for live broadcasting).
 *  - "transmisión" → "emisión".
 */
export default {
  // "anótate" (LatAm) → "apúntate" (Spain)
  'overlay.signUp': '¡apúntate!',

  // "boleto" (LatAm) → "billete" (Spain) — keep both the configurator + landing chip in sync
  'configurator.theme.ticket': 'Billete vintage',
  'landing.theme.ticket': 'Billete vintage',

  // "ingresar" for data entry reads Latin-American; Spain uses "introducir"
  'configurator.urlPlaceholder': 'Introduce un evento arriba para generar tu URL',

  // "en vivo" (LatAm) → "en directo" (Spain). The Live Link's own name carries
  // the term, so every string that says it has to be overridden together —
  // half-translating it would leave "Enlace en Vivo" beside "en directo".
  'configurator.slugDemo': '✓ Programación de demostración incorporada — pega tu enlace de RaidPal para salir en directo',
  'configurator.chipLive': 'EN DIRECTO',
  'configurator.navLiveLink': 'Enlace en Directo',
  'configurator.llUrlAria': 'URL del Enlace en Directo',
  'configurator.llCopy': 'Copiar Enlace en Directo',
  'configurator.llSub': 'Pega esta <b>única URL</b> en OBS una sola vez. Siempre muestra tu raid train <b>en directo</b> — o el siguiente — usando los ajustes guardados de cada tren.',
  'configurator.llIdleToggle': 'Mostrar una tarjeta de próximos trenes mientras no haya ninguno en directo',
  'configurator.noTrains': 'No hay raid trains en directo ni próximos. Únete a uno en RaidPal y aparecerá aquí.',
  'configurator.profileMenuHint': 'Un Perfil es simplemente un nombre de usuario de Twitch. Cada Perfil guarda sus propios raid trains, sus Configs de raid train y su Enlace en Directo.',
  'configurator.cfgLinkHint': 'Un enlace directo solo para este tren. Tu Enlace en Directo recoge estos ajustes automáticamente — este solo hace falta para una fuente fijada a este tren concreto.',
  'configurator.defaultPresetTitle': 'Las nuevas Configs de raid train y tu Enlace en Directo parten de este Preajuste',
  'configurator.defaultPresetHint': 'Las nuevas Configs de raid train y tu Enlace en Directo parten de este Preajuste. Es lo mismo que la estrella en la <a href="#" data-act="goto-presets">Biblioteca de Preajustes</a>.',
  'configurator.oneOffSub': 'Crea un único enlace de overlay para cualquier evento de RaidPal — o escribe una programación a mano. Nada de esto toca tu Perfil, tus Preajustes ni tu Enlace en Directo.',
  'configurator.toastLiveLinkCopied': 'Enlace en Directo copiado — pégalo en OBS',
  'configurator.toastIdleOn': 'Tarjeta de espera activada — vuelve a copiar tu Enlace en Directo',
  'configurator.toastIdleOff': 'Tarjeta de espera desactivada — vuelve a copiar tu Enlace en Directo',
  'configurator.toastHorizonUpdated': 'Horizonte actualizado — vuelve a copiar tu Enlace en Directo',

  // "transmisión" (LatAm) → "emisión" (Spain)
  'configurator.scaleHint': 'Lo grande que se ve el tren en tu emisión. 1 es el valor por defecto; menos es más pequeño, más es más grande. Observa la vista previa.',
  'configurator.delPresetUsedOne': '{n} Config de raid train lo usa. Sus ajustes se conservan — se copian en esa Config, así que nada cambia en emisión.',
  'configurator.delPresetUsedMany': '{n} Configs de raid train lo usan. Sus ajustes se conservan — se copian en esas Configs, así que nada cambia en emisión.',
};
