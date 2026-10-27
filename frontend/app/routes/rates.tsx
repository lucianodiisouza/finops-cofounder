import { useCallback, useEffect, useState } from "react";
import type { Route } from "./+types/rates";
import { Shell } from "~/components/Shell";
import { Button, Card, EmptyState, Field, Input, Notice, Select } from "~/components/ui";
import { api, type Rate } from "~/lib/api";
import { currentMonth, formatMonthLong, parseDecimal } from "~/lib/format";
import { useSession } from "~/lib/session";
import { LoadingScreen } from "./dashboard";

export const meta: Route.MetaFunction = () => [{ title: "Cotações — FinOps" }];

export default function RatesPage() {
  const { user, loading } = useSession();
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [month, setMonth] = useState(currentMonth());
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRates(await api.listRates());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as cotações.");
    }
  }, []);

  useEffect(() => {
    if (user) void reload();
  }, [user, reload]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseDecimal(value);
    if (parsed === null || parsed <= 0) {
      setError("Informe uma cotação válida, por exemplo 5,42.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.upsertRate({ currency, month, rate: parsed });
      setValue("");
      setSaved(true);
      // Confirmação visível: o estado de sucesso some sozinho depois de 2,5s.
      setTimeout(() => setSaved(false), 2500);
      void reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a cotação.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rate: Rate) => {
    if (!confirm(`Excluir a cotação de ${rate.currency} em ${formatMonthLong(rate.month)}?`)) {
      return;
    }
    await api.deleteRate(rate.id);
    void reload();
  };

  if (loading || !user) return <LoadingScreen />;

  return (
    <Shell email={user.email}>
      <div className="enter">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-3">
          Cotações
        </p>
        <h1 className="mt-1 font-display text-4xl leading-none text-ink sm:text-5xl">
          Câmbio por mês
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
          Para somar tudo em reais, o FinOps precisa saber quanto valia cada moeda estrangeira
          no mês. Quando um mês não tem cotação, é usada a mais recente anterior — assim o
          histórico de meses passados não muda quando o dólar sobe hoje.
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Informar cotação
          </h2>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <Field label="Moeda">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </Select>
            </Field>
            <Field label="Mês de competência">
              <Input
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="tnum"
              />
            </Field>
            <Field label={`Quanto vale 1 ${currency} em reais`} hint="Use vírgula, ex.: 5,42.">
              <Input
                required
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="5,42"
                className="tnum"
              />
            </Field>

            {error && <Notice>{error}</Notice>}
            {saved && <Notice tone="accent">Cotação salva.</Notice>}

            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar cotação"}
            </Button>
          </form>
        </Card>

        <Card>
          <header className="border-b border-rule px-5 py-3 sm:px-6">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Cotações cadastradas
            </h2>
          </header>

          {!rates ? (
            <p className="px-6 py-10 text-sm text-ink-3">Carregando…</p>
          ) : rates.length === 0 ? (
            <EmptyState
              title="Nenhuma cotação ainda"
              description="Cadastre a cotação do dólar ou do euro do mês para que os serviços em moeda estrangeira entrem no total."
            />
          ) : (
            <ul>
              {rates.map((rate) => (
                <li
                  key={rate.id}
                  className="rule-row flex items-center justify-between gap-4 px-5 py-3 last:border-b-0 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">1 {rate.currency}</span>
                    <span className="text-ink-2"> = </span>
                    <span className="tnum font-semibold text-ink">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      }).format(rate.rate)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {formatMonthLong(rate.month)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(rate)}
                    className="shrink-0 cursor-pointer rounded-sm px-2 py-1 text-xs font-semibold text-ink-3 transition-colors hover:bg-alert-soft hover:text-alert"
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
