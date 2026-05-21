-- Migration: add missing columns to demandas table
-- Fixes PGRST204 error: columns not found in schema cache

ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS titulo               text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS demandante           uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS tipo_defeito         text,
  ADD COLUMN IF NOT EXISTS originada_diagnostico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_inicio_atendimento timestamp with time zone,
  ADD COLUMN IF NOT EXISTS prazo_solucao        timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_previsao_encerramento date;
