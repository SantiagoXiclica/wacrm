"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import {
  AutomationBuilder,
  type BuilderInitial,
  type BuilderStep,
} from "@/components/automations/automation-builder"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import type { AutomationStepType, AutomationTriggerType } from "@/types"

const TEMPLATE_NAME_KEYS: Record<TemplateSlug, string> = {
  welcome_message: "templateWelcomeMessage",
  out_of_office: "templateOutOfOffice",
  lead_qualifier: "templateLeadQualifier",
  follow_up_reminder: "templateFollowUpReminder",
}

const TEMPLATE_DESC_KEYS: Record<TemplateSlug, string> = {
  welcome_message: "templateWelcomeMessageDesc",
  out_of_office: "templateOutOfOfficeDesc",
  lead_qualifier: "templateLeadQualifierDesc",
  follow_up_reminder: "templateFollowUpReminderDesc",
}

export default function NewAutomationPage() {
  const params = useSearchParams()
  const template = params.get("template") as TemplateSlug | null
  const t = useTranslations("automations")

  const initial: BuilderInitial = useMemo(() => {
    if (template && AUTOMATION_TEMPLATES[template]) {
      const tmpl = AUTOMATION_TEMPLATES[template]
      const nameKey = TEMPLATE_NAME_KEYS[template]
      const descKey = TEMPLATE_DESC_KEYS[template]
      const steps = expandFromSeeds(
        tmpl.steps.map((seed, idx) => ({
          index: idx,
          step_type: seed.step_type,
          step_config: seed.step_config as Record<string, unknown>,
          branch: seed.branch ?? null,
          parent_index: seed.parent_index ?? null,
        })),
      )
      return {
        name: nameKey ? t(nameKey) : tmpl.name,
        description: descKey ? t(descKey) : tmpl.description,
        trigger_type: tmpl.trigger_type,
        trigger_config: tmpl.trigger_config as Record<string, unknown>,
        is_active: false,
        steps,
      }
    }
    return {
      name: "",
      description: "",
      trigger_type: "new_message_received" as AutomationTriggerType,
      trigger_config: {},
      is_active: false,
      steps: [],
    }
  }, [template, t])

  return <AutomationBuilder initial={initial} />
}

interface SeedRow {
  index: number
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branch: "yes" | "no" | null
  parent_index: number | null
}

function uid(): string {
  return (
    "c_" +
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  )
}

/** Template seeds are flat with parent_index references. Expand into the
 *  builder's nested tree, preserving order within each scope. */
function expandFromSeeds(rows: SeedRow[]): BuilderStep[] {
  const nodes: BuilderStep[] = rows.map((r) => ({
    cid: uid(),
    step_type: r.step_type,
    step_config: r.step_config,
    branches:
      r.step_type === "condition" ? { yes: [], no: [] } : undefined,
  }))
  const roots: BuilderStep[] = []
  rows.forEach((r, i) => {
    if (r.parent_index == null) {
      roots.push(nodes[i])
      return
    }
    const parent = nodes[r.parent_index]
    if (!parent.branches) parent.branches = { yes: [], no: [] }
    parent.branches[r.branch ?? "yes"].push(nodes[i])
  })
  return roots
}
