-- O valor precisa ser criado em uma transação anterior à migration que o usa.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_contrato';
