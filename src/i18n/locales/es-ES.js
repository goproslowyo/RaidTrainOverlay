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
  'configurator.sub': 'Introduce tu evento, previsualízalo y luego copia el enlace en una fuente de Navegador de OBS.',
  'configurator.previewPlaceholder': 'Tu vista previa en directo aparece aquí en cuanto introduces un evento.',
  'configurator.previewEnterValid': 'Introduce un evento válido para ver la vista previa.',
  'configurator.urlPlaceholder': 'Introduce un evento arriba para generar tu URL',

  // "en vivo" (LatAm) → "en directo" (Spain)
  'configurator.slugDemo': '✓ Programación de demostración incorporada — pega tu enlace de RaidPal para salir en directo',

  // "transmisión" (LatAm) → "emisión" (Spain)
  'configurator.scaleHint': 'Lo grande que se ve el tren en tu emisión. 1 es el valor por defecto; menos es más pequeño, más es más grande. Observa la vista previa.',
};
