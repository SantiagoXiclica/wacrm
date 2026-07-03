'use client';

import { Shield, SlidersHorizontal } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CustomFieldsPanel } from '@/components/contacts/custom-fields-manager';
import { SettingsChip } from './settings-chip';
import { useTranslations } from 'next-intl';

/**
 * Settings → Custom Fields card. Manages the account-wide custom
 * contact field catalogue (the same panel the Contacts page exposes
 * via a dialog). Writes are admin-gated by the caller and enforced by
 * `custom_fields` RLS.
 */
export function CustomFieldsSettings() {
  const t = useTranslations('settingsPanels');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <SlidersHorizontal className="size-4 text-primary" />
          {t('fieldsTagsTitle')}
          <SettingsChip variant="admin" className="font-medium">
            <Shield />
            Admin
          </SettingsChip>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('fieldsTagsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CustomFieldsPanel />
      </CardContent>
    </Card>
  );
}
