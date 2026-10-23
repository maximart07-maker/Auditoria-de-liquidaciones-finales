import { Caso } from './api-client';

/** La API solo deja eliminar casos en borrador o en revisión. */
export function esCasoEliminable(estado: Caso['estado']): boolean {
  return estado === 'borrador' || estado === 'en_revision';
}
