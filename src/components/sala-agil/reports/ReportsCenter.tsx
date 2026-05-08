import { useState } from 'react';
import { ReportSelector } from './ReportSelector';
import { BillingReport } from './reports/BillingReport';
import { IndividualReport } from './reports/IndividualReport';
import { SprintReport } from './reports/SprintReport';
import { QualityReport } from './reports/QualityReport';
import { VelocityReport } from './reports/VelocityReport';
import { BurndownReport } from './reports/BurndownReport';
import { ImpedimentReport } from './reports/ImpedimentReport';
import { ReleaseNotesReport } from './reports/ReleaseNotesReport';
import { ReportType } from './types';
import { ReportData } from './ReportExporter';
import { Separator } from '@/components/ui/separator';

interface Props {
  sprints?: { id: string; name: string }[];
  developers?: { id: string; name: string; role: string }[];
  billingData?: ReportData;
  currentUserName?: string;
}

export function ReportsCenter({
  sprints = [],
  developers = [],
  billingData,
  currentUserName = 'Usuário',
}: Props) {
  const [selected, setSelected] = useState<ReportType | null>(null);
  const data: ReportData | undefined = billingData;

  return (
    <div className="space-y-0">
      <div className="bg-card border-b">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold text-foreground">Selecione o relatório</h2>
          <p className="text-xs text-muted-foreground">Clique em um relatório para configurar e gerar</p>
        </div>
        <ReportSelector selected={selected} onSelect={setSelected} />
      </div>

      <Separator />

      <div className="p-4">
        {!selected && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-sm text-muted-foreground">Selecione um relatório acima para começar</p>
          </div>
        )}

        {selected === 'individual' && data && (
          <IndividualReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'sprint' && data && (
          <SprintReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'quality' && data && (
          <QualityReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'velocity' && data && (
          <VelocityReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'burndown' && data && (
          <BurndownReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'impediment' && data && (
          <ImpedimentReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'release' && data && (
          <ReleaseNotesReport data={data} emittedBy={currentUserName} />
        )}
        {selected === 'billing' && billingData && (
          <BillingReport data={billingData} sprints={sprints} emittedBy={currentUserName} />
        )}
      </div>
    </div>
  );
}
