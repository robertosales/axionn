import { z } from "zod";
import { parseBRLInput } from "@/lib/currency";

export const invoiceFormSchema = z.object({
  tenantId: z.string().uuid({ message: "Selecione uma assinatura." }),
  billingPeriod: z.enum(["monthly", "quarterly", "annual"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Informe o vencimento." }),
  amount: z.string().trim().refine((value) => {
    if (!value) return true;
    const parsed = parseBRLInput(value);
    return parsed !== null && parsed > 0;
  }, { message: "Valor deve ser um número positivo." }),
  notes: z.string().max(2000, { message: "Observações devem ter no máximo 2000 caracteres." }),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const billingReasonSchema = z.object({
  reason: z.string().trim()
    .min(3, { message: "Descreva o motivo (mínimo 3 caracteres)." })
    .max(500, { message: "Motivo deve ter no máximo 500 caracteres." }),
});

export const planPriceSchema = z.object({
  monthlyPrice: z.number().min(0, { message: "Preço mensal não pode ser negativo." }),
  annualPrice: z.number().min(0, { message: "Preço anual não pode ser negativo." }),
  currency: z.string().trim().length(3, { message: "Moeda deve ter 3 letras (ex.: BRL)." }),
});
