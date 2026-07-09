import { ShieldCheck, Timer, Database, KeyRound } from "lucide-react";

export default function BOConfiguracoes() {
  const items = [
    { icon: ShieldCheck, title: "Acesso interno", text: "Somente membros ativos da Roberto Sales LTDA, controlados por role." },
    { icon: Timer, title: "Sessão", text: "Timeout e autenticação seguem as políticas centrais do Axionn." },
    { icon: Database, title: "Auditoria", text: "Alterações críticas de staff, faturamento e suporte são registradas." },
    { icon: KeyRound, title: "2FA", text: "Recomendado para todo o staff; obrigatoriedade planejada para a próxima versão." },
  ];
  return <div className="space-y-5"><div><h1 className="text-xl font-semibold">Configurações</h1><p className="text-sm text-muted-foreground">Políticas operacionais e de segurança do Backoffice.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{items.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-lg border bg-white p-5"><div className="flex items-center gap-3"><div className="rounded-md bg-cyan-500/10 p-2 text-cyan-700"><Icon className="h-5 w-5" /></div><h2 className="font-semibold">{title}</h2></div><p className="mt-3 text-sm text-muted-foreground">{text}</p></div>)}</div>
  </div>;
}
