'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { useRolePermissions } from '@/hooks/use-role-permissions';
import { SettingsPanelHead } from './settings-panel-head';
import { ROLE_META } from './role-meta';
import type { Role, RolePermissions } from '@/types';
import type { AccountRole } from '@/lib/auth/roles';

const MODULES = [
  'dashboard', 'inbox', 'notifications', 'contacts',
  'pipelines', 'broadcasts', 'automations', 'flows',
  'agent_performance',
] as const;

const SETTINGS_ACTIONS = [
  'whatsapp', 'templates', 'fields_tags', 'deals_currency',
  'members', 'ai', 'api_keys', 'roles',
] as const;

function buildEmptyPermissions(): RolePermissions {
  const perms: RolePermissions = {};
  for (const mod of MODULES) {
    perms[mod] = { view: false };
  }
  perms.settings = {};
  for (const act of SETTINGS_ACTIONS) {
    perms.settings[act] = false;
  }
  return perms;
}

export function RolesPanel() {
  const t = useTranslations('settings');
  const { accountRole } = useAuth();
  const { refreshRoles } = useRolePermissions();
  const [loading, setLoading] = useState(true);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRank, setNewRank] = useState(5);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<RolePermissions>({});

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/account/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      setAllRoles(data.roles ?? []);
    } catch (err) {
      console.error('[RolesPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRoles(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/account/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), rank: newRank, permissions: buildEmptyPermissions() }),
      });
      if (!res.ok) throw new Error('Failed to create role');
      setCreateOpen(false);
      setNewName('');
      setNewRank(5);
      await fetchRoles();
      await refreshRoles();
      toast.success(t('rolesCreated'));
    } catch {
      toast.error(t('rolesError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/account/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete role');
      await fetchRoles();
      await refreshRoles();
      toast.success(t('rolesDeleted'));
    } catch {
      toast.error(t('rolesError'));
    }
  };

  const handleSavePermissions = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/account/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPerms }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      await fetchRoles();
      await refreshRoles();
      setExpandedId(null);
      toast.success(t('rolesUpdated'));
    } catch {
      toast.error(t('rolesError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (role: Role) => {
    if (expandedId === role.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(role.id);
    setEditPerms(JSON.parse(JSON.stringify(role.permissions)));
  };

  const toggleModulePerm = (mod: string, action: string) => {
    setEditPerms(prev => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !(prev[mod]?.[action]) },
    }));
  };

  const toggleSettingPerm = (action: string) => {
    setEditPerms(prev => ({
      ...prev,
      settings: { ...prev.settings, [action]: !(prev.settings?.[action]) },
    }));
  };

  if (accountRole !== 'owner') {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        {t('rolesOwnerOnly')}
      </div>
    );
  }

  return (
    <div>
      <SettingsPanelHead
        title={t('rolesLabel')}
        description={t('rolesDescription')}
        action={
          <RequireRole min="owner">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              {t('rolesCreate')}
            </Button>
          </RequireRole>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : allRoles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('rolesNoRoles')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allRoles.map(role => {
            const meta = ROLE_META[role.name.toLowerCase() as AccountRole] ?? {
              icon: Shield, label: role.name, variant: 'secondary' as const,
            };
            const Icon = meta.icon;
            const isExpanded = expandedId === role.id;
            const rankLabel = role.rank >= 10 ? t('rolesRankOwner')
              : role.rank >= 8 ? t('rolesRankAdmin')
              : role.rank >= 5 ? t('rolesRankAgent')
              : t('rolesRankViewer');

            return (
              <Card key={role.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{role.name}</span>
                    <span className="text-xs text-muted-foreground">{rankLabel}</span>
                    {role.is_system && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        {t('rolesSystem')}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(role)}
                      >
                        {isExpanded ? t('rolesCollapse') : t('rolesExpand')}
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {t('rolesModules')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {MODULES.map(mod => (
                            <label key={mod} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editPerms[mod]?.view === true}
                                onChange={() => toggleModulePerm(mod, 'view')}
                                className="rounded border-border"
                              />
                              {t(`rolesModule_${mod}`)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {t('rolesSettings')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {SETTINGS_ACTIONS.map(act => (
                            <label key={act} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editPerms.settings?.[act] === true}
                                onChange={() => toggleSettingPerm(act)}
                                className="rounded border-border"
                              />
                              {t(`rolesSetting_${act}`)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSavePermissions(role.id)}
                          disabled={saving}
                        >
                          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                          {t('rolesSave')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rolesCreateTitle')}</DialogTitle>
            <DialogDescription>{t('rolesCreateDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="role-name">{t('rolesName')}</Label>
              <Input
                id="role-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('rolesNamePlaceholder')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="role-rank">{t('rolesRank')}</Label>
              <Input
                id="role-rank"
                type="number"
                min={2}
                max={9}
                value={newRank}
                onChange={e => setNewRank(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('rolesRankHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('rolesCancel')}
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {t('rolesCreateConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
