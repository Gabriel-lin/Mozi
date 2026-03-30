import type { Template, TemplateCategory } from "../types";
import { agentTemplates } from "./agent";
import { workflowTemplates } from "./workflow";
import { skillTemplates } from "./skill";
import { contextTemplates } from "./context";

const registry = new Map<string, Template>();

function registerAll(templates: Template[]) {
  for (const t of templates) {
    registry.set(`${t.category}:${t.name}`, t);
  }
}

registerAll(agentTemplates);
registerAll(workflowTemplates);
registerAll(skillTemplates);
registerAll(contextTemplates);

export function getTemplate(category: TemplateCategory, name: string): Template | undefined {
  return registry.get(`${category}:${name}`);
}

export function listTemplates(category?: TemplateCategory): Template[] {
  const all = Array.from(registry.values());
  return category ? all.filter((t) => t.category === category) : all;
}

export function getTemplateNames(category: TemplateCategory): string[] {
  return listTemplates(category).map((t) => t.name);
}

export function registerTemplate(template: Template): void {
  registry.set(`${template.category}:${template.name}`, template);
}

export function unregisterTemplate(category: TemplateCategory, name: string): boolean {
  return registry.delete(`${category}:${name}`);
}

export { agentTemplates, workflowTemplates, skillTemplates, contextTemplates };
