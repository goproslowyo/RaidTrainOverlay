// Spanish (Mexico) regional overrides, merged over es.js
/**
 * Spanish — Mexico (es-MX) overrides.
 * Machine-translated draft, pending native review.
 *
 * Only keys whose wording genuinely diverges from neutral es.js for Mexican
 * Spanish (vocabulary, tone). Merged OVER es.js; everything else falls back.
 * The neutral base already leans Latin-American ("boleto", "en vivo",
 * "ingresa", "transmisión") — all natural in Mexico — so this set is small.
 * Interpolation tokens and HTML markup are preserved verbatim.
 *
 * Mexican divergences captured:
 *  - "¡anótate!" → "¡regístrate!" (the more common open-slot CTA in MX).
 */
export default {
  // Mexico more commonly invites viewers to "regístrate"; 13 chars, fits the badge budget (14)
  'overlay.signUp': '¡regístrate!',

  // Keep the open-slot help text in sync with the "regístrate" CTA above
  'configurator.openslotsHint': 'Muestra los espacios sin asignar como vagones <strong>LIBRE</strong> para que los espectadores se registren.',
};
