import { useEffect, useState } from "react";
import { api, type Service, type ServicePayload } from "~/lib/api";
import {
  categoryLabels,
  centsToInput,
  cycleLabels,
  firstDayOfMonth,
  parseAmountToCents,
} from "~/lib/format";
import { Button, Dialog, Field, Input, Notice, Select, Textarea } from "./ui";

const currencyOptions = [
  { value: "BRL", label: "BRL — Real" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
];

/** Formulário de serviço, usado para cadastrar e editar um custo recorrente. */
export function ServiceDialog({
  open,
  projectId,
  service,
  month,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  service?: Service;
  /** Mês em exibição: define a data de início sugerida para um serviço novo. */
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("servidor");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [cycle, setCycle] = useState("monthly");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setCategory(service?.category ?? "servidor");
    setAmount(service ? centsToInput(service.amount_cents) : "");
    setCurrency(service?.currency ?? "BRL");
    setCycle(service?.billing_cycle ?? "monthly");
    setStartsOn(service?.starts_on ?? firstDayOfMonth(month));
    setEndsOn(service?.ends_on ?? "");
    setNotes(service?.notes ?? "");
    setError("");
  }, [open, service, month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("Informe um valor válido, por exemplo 79,90.");
      return;
    }
    const payload: ServicePayload = {
      name,
      category,
      amount_cents: amountCents,
      currency,
      billing_cycle: cycle,
      starts_on: startsOn,
      ends_on: endsOn === "" ? null : endsOn,
      notes,
    };

    setError("");
    setSaving(true);
    try {
      if (service) {
        await api.updateService(service.id, payload);
      } else {
        await api.createService(projectId, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o serviço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} title={service ? "Editar serviço" : "Novo serviço"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome do serviço">
          <Input
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VPS Hetzner CX22"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ciclo" hint={cycle === "yearly" ? "O valor anual é dividido por 12." : undefined}>
            <Select value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {Object.entries(cycleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Valor" hint="Use vírgula para os centavos.">
            <Input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="79,90"
              className="tnum"
            />
          </Field>
          <Field label="Moeda">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início da cobrança">
            <Input
              type="date"
              required
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="Término" hint="Deixe vazio se o serviço continua ativo.">
            <Input
              type="date"
              min={startsOn}
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className="tnum"
            />
          </Field>
        </div>

        <Field label="Observações" hint="Opcional: conta usada, data de renovação…">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <Notice>{error}</Notice>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar serviço"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
