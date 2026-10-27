import { useEffect, useState } from "react";
import { api, type Project } from "~/lib/api";
import { nextProjectColor, projectColors } from "~/lib/colors";
import { Button, Dialog, Field, Input, Notice, Textarea } from "./ui";

/** Formulário de projeto, usado tanto para criar quanto para editar. */
export function ProjectDialog({
  open,
  project,
  existingCount,
  onClose,
  onSaved,
}: {
  open: boolean;
  project?: Project;
  existingCount: number;
  onClose: () => void;
  onSaved: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(projectColors[0].light);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Recarrega os campos a cada abertura, para não vazar dados de uma edição anterior.
  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setColor(project?.color ?? nextProjectColor(existingCount));
    setError("");
  }, [open, project, existingCount]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { name, description, color };
      const saved = project
        ? await api.updateProject(project.id, body)
        : await api.createProject(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} title={project ? "Editar projeto" : "Novo projeto"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome do projeto">
          <Input
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Loja Online"
          />
        </Field>
        <Field label="Descrição" hint="Opcional.">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E-commerce de camisetas"
          />
        </Field>
        <Field label="Cor" hint="Identifica o projeto nos gráficos.">
          <div className="flex flex-wrap gap-2 pt-1">
            {projectColors.map((option) => (
              <button
                key={option.light}
                type="button"
                onClick={() => setColor(option.light)}
                title={option.name}
                aria-label={option.name}
                aria-pressed={color === option.light}
                className={
                  "size-8 cursor-pointer rounded-full transition-transform " +
                  (color === option.light
                    ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]"
                    : "hover:scale-105")
                }
                style={{ backgroundColor: option.light }}
              />
            ))}
          </div>
        </Field>

        {error && <Notice>{error}</Notice>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar projeto"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
