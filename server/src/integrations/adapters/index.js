/**
 * Adapter registry.
 *
 * Every platform is served by the configuration-driven 'generic-json' adapter: request
 * building, authentication, pagination and response normalisation are all defined by the
 * saved integration configuration — no per-platform code.
 *
 * If a future platform has fundamentally different business semantics (for example it only
 * exposes raw billing events that must be aggregated with platform-specific rules), add an
 * adapter here implementing the same interface:
 *
 *   {
 *     id: 'my-adapter',
 *     label: 'Human readable name',
 *     description: 'What it does and which assumptions it makes',
 *     // Optional hooks. Each receives the normalised result of the generic pipeline and must
 *     // return the same shape. Hooks must document the business rules they apply.
 *     postNormalize?(normalized, { config, platform, request }) => normalized
 *   }
 *
 * and select it in the platform's integration configuration. Adapters run server-side only
 * and are code-reviewed — configuration can select an adapter but never supply code.
 */
export const ADAPTERS = {
  'generic-json': {
    id: 'generic-json',
    label: 'Generic JSON API',
    description: 'Configuration-driven JSON over HTTPS: mapped query parameters, configurable response paths and field mappings.'
  }
};

export function getAdapter(id) {
  return ADAPTERS[id] || ADAPTERS['generic-json'];
}

export function listAdapters() {
  return Object.values(ADAPTERS).map(({ id, label, description }) => ({ id, label, description }));
}
