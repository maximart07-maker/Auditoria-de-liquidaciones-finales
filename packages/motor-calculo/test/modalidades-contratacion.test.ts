import { describe, expect, it } from 'vitest';
import { descripcionModalidadContratacion, normalizarCodigoModalidad } from '../src/modalidades-contratacion';
import { aplicaConceptoF931, tratamientoModalidad } from '../src/control-f931';

describe('modalidades de contratación', () => {
  it('normaliza los ceros a la izquierda', () => {
    expect(normalizarCodigoModalidad('008')).toBe('8');
    expect(normalizarCodigoModalidad(' 27 ')).toBe('27');
    expect(normalizarCodigoModalidad('X1')).toBe('X1');
  });

  it('describe los códigos del catálogo y el rango 601 a 614', () => {
    expect(descripcionModalidadContratacion('008')).toBe('A tiempo completo - Indeterminado / Permanente');
    expect(descripcionModalidadContratacion('27')).toMatch(/Pasantías educativas/);
    expect(descripcionModalidadContratacion('605')).toMatch(/incentivo o formalización/);
    expect(descripcionModalidadContratacion('99')).toBeNull();
  });

  it('aplica las reglas de pasantes y contrato 99 aunque el código venga con ceros', () => {
    expect(aplicaConceptoF931('APORTE_INSSJP', '027')).toBe(false);
    expect(aplicaConceptoF931('CONTRIB_ART', '027')).toBe(true);
    expect(aplicaConceptoF931('CONTRIB_OBRA_SOCIAL', '099')).toBe(false);
    expect(aplicaConceptoF931('APORTE_SIPA', '008')).toBe(true);
    expect(tratamientoModalidad('099')).toBe('Solo ART.');
  });
});
