import { BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import z from 'zod';

/**
 * Schema esperado do XML de metadados de documento.
 *
 * Estrutura:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <document-metadata>
 *   <!-- Obrigatórios -->
 *   <type>invoice</type>                      <!-- invoice | contract | report | receipt | other -->
 *   <issuedAt>25/12/2024</issuedAt>           <!-- dd/mm/aaaa -->
 *   <issuer>
 *     <name>Empresa ABC Ltda</name>
 *     <document>12.345.678/0001-99</document> <!-- CPF ou CNPJ -->
 *   </issuer>
 *   <recipient>
 *     <name>João Silva</name>
 *     <document>123.456.789-00</document>
 *   </recipient>
 *
 *   <!-- Opcionais -->
 *   <reference>NF-2024/001</reference>        <!-- número de referência externo -->
 *   <dueAt>25/01/2025</dueAt>                 <!-- dd/mm/aaaa -->
 *   <total>1500.00</total>                    <!-- valor decimal -->
 *   <currency>BRL</currency>                  <!-- ISO 4217, padrão: BRL -->
 *   <notes>Referente ao contrato X</notes>
 * </document-metadata>
 * ```
 */

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

const partySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  document: z.string().min(1, 'CPF/CNPJ obrigatório'),
});

const metadataSchema = z.object({
  type: z
    .enum(['invoice', 'contract', 'report', 'receipt', 'other'])
    .refine(Boolean, 'Tipo inválido. Use: invoice, contract, report, receipt ou other'),
  issuedAt: z
    .string()
    .regex(DATE_REGEX, 'issuedAt deve estar no formato dd/mm/aaaa'),
  issuer: partySchema,
  recipient: partySchema,
  reference: z.string().optional(),
  dueAt: z
    .string()
    .regex(DATE_REGEX, 'dueAt deve estar no formato dd/mm/aaaa')
    .optional(),
  total: z.number().positive('O valor total deve ser positivo').optional(),
  currency: z.string().length(3, 'Currency deve ter 3 caracteres (ISO 4217)').default('BRL'),
  notes: z.string().optional(),
});

export type XmlMetadata = z.infer<typeof metadataSchema>;

const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });

export function parseAndValidateXml(xmlContent: string): XmlMetadata {
  let parsed: Record<string, unknown>;

  try {
    parsed = xmlParser.parse(xmlContent);
  } catch {
    throw new BadRequestException('XML malformado — verifique a estrutura do arquivo');
  }

  const root = parsed['document-metadata'];

  if (!root) {
    throw new BadRequestException('XML inválido — elemento raiz <document-metadata> não encontrado');
  }

  const result = metadataSchema.safeParse(root);

  if (!result.success) {
    const messages = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new BadRequestException(messages);
  }

  return result.data;
}
