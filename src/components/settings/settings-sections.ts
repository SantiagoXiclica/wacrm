import {
  Coins,
  FileText,
  KeyRound,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  Sparkles,
  Tags,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture for the redesigned page.
 *
 * The flat tab strip became a grouped left rail with a new Overview
 * landing. The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working) — we
 * just map the old values onto the new sections.
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'whatsapp',
  'templates',
  'fields',
  'deals',
  'members',
  'ai',
  'api',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'overview', icon: LayoutGrid, group: 'top' },
  profile: { id: 'profile', label: 'yourProfile', icon: User, group: 'account' },
  security: { id: 'security', label: 'loginSecurity', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', label: 'appearanceLabel', icon: Palette, group: 'account' },
  whatsapp: { id: 'whatsapp', label: 'whatsappLabel', icon: PlugZap, group: 'workspace' },
  templates: { id: 'templates', label: 'templatesLabel', icon: FileText, group: 'workspace' },
  fields: { id: 'fields', label: 'fieldsAndTagsLabel', icon: Tags, group: 'workspace' },
  deals: { id: 'deals', label: 'dealsAndCurrencyLabel', icon: Coins, group: 'workspace' },
  members: { id: 'members', label: 'teamMembersLabel', icon: UsersRound, group: 'workspace' },
  ai: { id: 'ai', label: 'aiAssistantLabel', icon: Sparkles, group: 'workspace' },
  api: { id: 'api', label: 'apiKeysLabel', icon: KeyRound, group: 'workspace' },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'accountGroup', group: 'account' },
  { label: 'workspaceGroup', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home (Tags + Custom fields → the
 * merged "Fields & tags" section). Anything unknown falls back to the
 * Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
