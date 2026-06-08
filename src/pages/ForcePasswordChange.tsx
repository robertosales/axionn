import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, ShieldAlert } from "lucide-react";

export default function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const code = (error as any).code || "";
      const msg = error.message || "";
      let friendly = msg;
      if (code === "same_password" || /should be different from the old/i.test(msg)) {
        friendly = "A nova senha deve ser diferente da senha atual. Escolha outra.";
      } else if (code === "weak_password" || /weak|pwned|leaked/i.test(msg)) {
        friendly = "Senha muito fraca ou exposta em vazamentos. Use uma senha mais forte.";
      } else if (/at least.*characters/i.test(msg)) {
        friendly = "A senha não atende ao tamanho mínimo exigido.";
      }
      toast.error(friendly);
      setLoading(false);
      return;
    }
    if (user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("user_id", user.id);
    }
    toast.success("Senha atualizada com sucesso!");
    setLoading(false);
    onDone();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-amber-300">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold">Troca de senha obrigatória</CardTitle>
          <CardDescription>
            Sua senha foi redefinida pelo administrador. Defina uma nova senha pessoal para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fpc-pwd">Nova senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fpc-pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fpc-confirm">Confirmar nova senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fpc-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Definir nova senha"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={signOut} disabled={loading}>
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}