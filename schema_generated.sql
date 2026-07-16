-- ===========================================
-- Supabase schema generated from MCP queries
-- ===========================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ENUM TYPES
CREATE TYPE account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');

-- TABLES
CREATE TABLE accounts (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  default_currency text DEFAULT 'COP' NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE member_presence (
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  status text DEFAULT 'online' NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id)
);

CREATE TABLE flows (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft' NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}' NOT NULL,
  entry_node_id text,
  fallback_policy jsonb DEFAULT '{"on_exhaust": "handoff", "max_reprompts": 2, "on_timeout_hours": 24, "on_unknown_reply": "reprompt"}' NOT NULL,
  execution_count integer DEFAULT 0 NOT NULL,
  last_executed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE broadcasts (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  template_name text NOT NULL,
  template_language text DEFAULT 'en_US' NOT NULL,
  template_variables jsonb,
  audience_filter jsonb,
  scheduled_at timestamptz,
  status text DEFAULT 'draft' NOT NULL,
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  replied_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE tags (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3b82f6' NOT NULL,
  created_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE custom_fields (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  field_type text DEFAULT 'text' NOT NULL,
  field_options jsonb,
  created_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE message_templates (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'Marketing' NOT NULL,
  language text DEFAULT 'en_US',
  header_type text,
  header_content text,
  body_text text NOT NULL,
  footer_text text,
  buttons jsonb,
  status text DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sample_values jsonb,
  meta_template_id text,
  rejection_reason text,
  quality_score text,
  header_handle text,
  header_media_url text,
  submission_error text,
  last_submitted_at timestamptz,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] DEFAULT '{}' NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE flow_nodes (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  flow_id uuid NOT NULL,
  node_key text NOT NULL,
  node_type text NOT NULL,
  config jsonb DEFAULT '{}' NOT NULL,
  position_x integer DEFAULT 0 NOT NULL,
  position_y integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE automations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}' NOT NULL,
  is_active boolean DEFAULT false NOT NULL,
  execution_count integer DEFAULT 0 NOT NULL,
  last_executed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE account_invitations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  account_id uuid NOT NULL,
  token_hash text NOT NULL,
  role account_role_enum NOT NULL,
  created_by_user_id uuid,
  label text,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE ai_configs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  created_by uuid,
  provider text NOT NULL,
  model text NOT NULL,
  api_key text NOT NULL,
  system_prompt text,
  is_active boolean DEFAULT false NOT NULL,
  auto_reply_enabled boolean DEFAULT false NOT NULL,
  auto_reply_max_per_conversation integer DEFAULT 3 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  embeddings_api_key text,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE whatsapp_config (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  phone_number_id text NOT NULL,
  waba_id text,
  access_token text NOT NULL,
  verify_token text,
  status text DEFAULT 'disconnected' NOT NULL,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  registered_at timestamptz,
  subscribed_apps_at timestamptz,
  last_registration_error text,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  name text NOT NULL,
  rank integer NOT NULL,
  is_system boolean DEFAULT false NOT NULL,
  permissions jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE pipelines (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE profiles (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  beta_features text[] DEFAULT ARRAY[]::text[] NOT NULL,
  account_id uuid NOT NULL,
  account_role account_role_enum NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE contacts (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  email text,
  company text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  phone_normalized text,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE ai_knowledge_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  created_by uuid,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE conversations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  assigned_agent_id uuid,
  last_message_text text,
  last_message_at timestamptz,
  unread_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  ai_autoreply_disabled boolean DEFAULT false NOT NULL,
  ai_reply_count integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE contact_notes (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  contact_id uuid NOT NULL,
  user_id uuid NOT NULL,
  note_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE automation_steps (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  automation_id uuid NOT NULL,
  parent_step_id uuid,
  branch text,
  step_type text NOT NULL,
  step_config jsonb DEFAULT '{}' NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_step_id) REFERENCES automation_steps(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE messages (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  conversation_id uuid NOT NULL,
  sender_type text NOT NULL,
  sender_id uuid,
  content_type text DEFAULT 'text' NOT NULL,
  content_text text,
  media_url text,
  template_name text,
  message_id text,
  status text DEFAULT 'sent' NOT NULL,
  created_at timestamptz DEFAULT now(),
  reply_to_message_id uuid,
  interactive_reply_id text,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE contact_tags (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  contact_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE contact_custom_values (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  contact_id uuid NOT NULL,
  custom_field_id uuid NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE ai_knowledge_chunks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  account_id uuid NOT NULL,
  chunk_index integer DEFAULT 0 NOT NULL,
  content text NOT NULL,
  fts tsvector,
  embedding vector(1536),
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE notifications (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text DEFAULT 'conversation_assigned' NOT NULL,
  conversation_id uuid,
  contact_id uuid,
  actor_user_id uuid,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE pipeline_stages (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  color text DEFAULT '#3b82f6' NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE flow_runs (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  flow_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contact_id uuid,
  conversation_id uuid,
  status text DEFAULT 'active' NOT NULL,
  current_node_key text,
  last_prompt_message_id uuid,
  vars jsonb DEFAULT '{}' NOT NULL,
  reprompt_count integer DEFAULT 0 NOT NULL,
  started_at timestamptz DEFAULT now() NOT NULL,
  last_advanced_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  end_reason text,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (last_prompt_message_id) REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE broadcast_recipients (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  broadcast_id uuid NOT NULL,
  contact_id uuid,
  status text DEFAULT 'pending' NOT NULL,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  whatsapp_message_id text,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE deals (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  contact_id uuid,
  conversation_id uuid,
  title text NOT NULL,
  value numeric DEFAULT 0 NOT NULL,
  currency text DEFAULT 'USD',
  notes text,
  expected_close_date date,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  assigned_to uuid,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE automation_logs (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  automation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contact_id uuid,
  trigger_event text NOT NULL,
  steps_executed jsonb DEFAULT '[]' NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE flow_run_events (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  flow_run_id uuid NOT NULL,
  event_type text NOT NULL,
  node_key text,
  payload jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE message_reactions (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE automation_pending_executions (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  automation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contact_id uuid,
  log_id uuid,
  parent_step_id uuid,
  branch text,
  next_step_position integer NOT NULL,
  context jsonb DEFAULT '{}' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  run_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  account_id uuid NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (log_id) REFERENCES automation_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_step_id) REFERENCES automation_steps(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

-- MULTI-COLUMN UNIQUE CONSTRAINTS
ALTER TABLE contact_custom_values ADD CONSTRAINT contact_custom_values_contact_id_custom_field_id_key UNIQUE (contact_id, custom_field_id);
ALTER TABLE contact_tags ADD CONSTRAINT contact_tags_contact_id_tag_id_key UNIQUE (contact_id, tag_id);
ALTER TABLE flow_nodes ADD CONSTRAINT flow_nodes_flow_id_node_key_key UNIQUE (flow_id, node_key);
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_message_id_actor_type_actor_id_key UNIQUE (message_id, actor_type, actor_id);
ALTER TABLE roles ADD CONSTRAINT roles_account_id_name_key UNIQUE (account_id, name);

-- ===========================================
-- FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_knowledge_documents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_conversation_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_name TEXT;
  v_actor_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_agent_id IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.assigned_agent_id IS NULL
       OR NEW.assigned_agent_id IS NOT DISTINCT FROM OLD.assigned_agent_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.assigned_agent_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(name, ''), phone) INTO v_contact_name
  FROM contacts WHERE id = NEW.contact_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT full_name INTO v_actor_name
    FROM profiles WHERE user_id = auth.uid();
  END IF;

  INSERT INTO notifications (
    account_id, user_id, type, conversation_id, contact_id,
    actor_user_id, title, body
  ) VALUES (
    NEW.account_id,
    NEW.assigned_agent_id,
    'conversation_assigned',
    NEW.id,
    NEW.contact_id,
    auth.uid(),
    'New conversation assigned',
    COALESCE(v_actor_name, 'Someone') || ' assigned you a conversation with '
      || COALESCE(v_contact_name, 'a contact')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create assignment notification for conversation %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._bcast_cols_for_status(s text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF s = 'pending' THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF s = 'sent'      THEN RETURN ARRAY['sent_count']; END IF;
  IF s = 'delivered' THEN RETURN ARRAY['sent_count','delivered_count']; END IF;
  IF s = 'read'      THEN RETURN ARRAY['sent_count','delivered_count','read_count']; END IF;
  IF s = 'replied'   THEN RETURN ARRAY['sent_count','delivered_count','read_count','replied_count']; END IF;
  IF s = 'failed'    THEN RETURN ARRAY['failed_count']; END IF;
  RETURN ARRAY[]::TEXT[];
END;
$function$;

CREATE OR REPLACE FUNCTION public._bcast_bump(bid uuid, col text, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  EXECUTE format(
    'UPDATE broadcasts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    col, col
  ) USING delta, bid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_recipient_aggregate_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_cols TEXT[];
  new_cols TEXT[];
  c TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_cols := _bcast_cols_for_status(NEW.status);
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(OLD.broadcast_id, c, -1);
    END LOOP;
    RETURN OLD;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    new_cols := _bcast_cols_for_status(NEW.status);
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, -1);
    END LOOP;
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_default_roles(target_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE account_id = target_account_id) THEN
    RETURN;
  END IF;

  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Propietario', 10, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "import": true},
    "pipelines": {"view": true, "edit": true, "move_deals": true},
    "broadcasts": {"view": true, "create": true, "send": true},
    "automations": {"view": true, "create": true, "edit": true},
    "flows": {"view": true, "create": true, "edit": true},
    "agent_performance": {"view": true},
    "settings": {"whatsapp": true, "templates": true, "fields_tags": true, "deals_currency": true, "members": true, "ai": true, "api_keys": true, "roles": true}
  }');

  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Administrador', 8, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "import": true},
    "pipelines": {"view": true, "edit": true, "move_deals": true},
    "broadcasts": {"view": true, "create": true, "send": true},
    "automations": {"view": true, "create": true, "edit": true},
    "flows": {"view": true, "create": true, "edit": true},
    "agent_performance": {"view": true},
    "settings": {"whatsapp": true, "templates": true, "fields_tags": true, "deals_currency": true, "members": true, "ai": true, "api_keys": true, "roles": false}
  }');

  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Agente', 5, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "import": false},
    "pipelines": {"view": true, "edit": false, "move_deals": true},
    "broadcasts": {"view": true, "create": false, "send": false},
    "automations": {"view": false, "create": false, "edit": false},
    "flows": {"view": false, "create": false, "edit": false},
    "agent_performance": {"view": false},
    "settings": {"whatsapp": false, "templates": false, "fields_tags": false, "deals_currency": false, "members": false, "ai": false, "api_keys": false, "roles": false}
  }');

  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Visor', 1, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": false, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": false, "edit": false, "delete": false, "import": false},
    "pipelines": {"view": true, "edit": false, "move_deals": false},
    "broadcasts": {"view": true, "create": false, "send": false},
    "automations": {"view": false, "create": false, "edit": false},
    "flows": {"view": false, "create": false, "edit": false},
    "agent_performance": {"view": false},
    "settings": {"whatsapp": false, "templates": false, "fields_tags": false, "deals_currency": false, "members": false, "ai": false, "api_keys": false, "roles": false}
  }');
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_seed_roles_on_account_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM seed_default_roles(NEW.id);
  RETURN NEW;
END;
$function$;

-- RLS helper
CREATE OR REPLACE FUNCTION public.is_account_member(target_account_id uuid, min_role account_role_enum DEFAULT 'viewer'::account_role_enum)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = target_account_id
      AND CASE p.account_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
        >=
          CASE min_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
  );
$function$;

-- Trigger functions for phone_normalized and fts
CREATE OR REPLACE FUNCTION public.set_contacts_phone_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.phone_normalized := regexp_replace(NEW.phone, '\D', '', 'g');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_ai_knowledge_chunks_fts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.fts := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$function$;

-- ===========================================
-- TRIGGERS
-- ===========================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER ai_configs_updated_at BEFORE UPDATE ON public.ai_configs FOR EACH ROW EXECUTE FUNCTION update_ai_configs_updated_at();
CREATE TRIGGER ai_knowledge_documents_updated_at BEFORE UPDATE ON public.ai_knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_ai_knowledge_documents_updated_at();
CREATE TRIGGER roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION set_roles_updated_at();
CREATE TRIGGER seed_roles_on_account_create AFTER INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION trigger_seed_roles_on_account_create();
CREATE TRIGGER broadcast_recipients_aggregate AFTER INSERT OR DELETE OR UPDATE ON public.broadcast_recipients FOR EACH ROW EXECUTE FUNCTION broadcast_recipient_aggregate_trigger();
CREATE TRIGGER on_conversation_assigned AFTER INSERT OR UPDATE OF assigned_agent_id ON public.conversations FOR EACH ROW EXECUTE FUNCTION notify_conversation_assigned();

-- Trigger for phone_normalized on contacts
CREATE TRIGGER set_phone_normalized BEFORE INSERT OR UPDATE OF phone ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_contacts_phone_normalized();

-- Trigger for fts on ai_knowledge_chunks
CREATE TRIGGER set_fts BEFORE INSERT OR UPDATE OF content ON public.ai_knowledge_chunks FOR EACH ROW EXECUTE FUNCTION set_ai_knowledge_chunks_fts();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS POLICIES
-- ===========================================

-- profiles
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_select ON profiles FOR SELECT USING ((auth.uid() = user_id) OR is_account_member(account_id));
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- contacts
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY contacts_select ON contacts FOR SELECT USING (is_account_member(account_id));
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- tags
CREATE POLICY tags_insert ON tags FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY tags_select ON tags FOR SELECT USING (is_account_member(account_id));
CREATE POLICY tags_update ON tags FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY tags_delete ON tags FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- contact_tags
CREATE POLICY contact_tags_modify ON contact_tags FOR ALL USING (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum))));
CREATE POLICY contact_tags_select ON contact_tags FOR SELECT USING (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id))));

-- custom_fields
CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY custom_fields_select ON custom_fields FOR SELECT USING (is_account_member(account_id));
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- contact_custom_values
CREATE POLICY contact_custom_values_modify ON contact_custom_values FOR ALL USING (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum))));
CREATE POLICY contact_custom_values_select ON contact_custom_values FOR SELECT USING (EXISTS (SELECT 1 FROM contacts c WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id))));

-- contact_notes
CREATE POLICY contact_notes_insert ON contact_notes FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY contact_notes_select ON contact_notes FOR SELECT USING (is_account_member(account_id));
CREATE POLICY contact_notes_update ON contact_notes FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY contact_notes_delete ON contact_notes FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- conversations
CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY conversations_select ON conversations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY conversations_update ON conversations FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY conversations_delete ON conversations FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- messages
CREATE POLICY messages_modify ON messages FOR ALL USING (EXISTS (SELECT 1 FROM conversations c WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum))));
CREATE POLICY messages_select ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id))));

-- whatsapp_config
CREATE POLICY whatsapp_config_insert ON whatsapp_config FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY whatsapp_config_select ON whatsapp_config FOR SELECT USING (is_account_member(account_id));
CREATE POLICY whatsapp_config_update ON whatsapp_config FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY whatsapp_config_delete ON whatsapp_config FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- message_templates
CREATE POLICY message_templates_insert ON message_templates FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY message_templates_select ON message_templates FOR SELECT USING (is_account_member(account_id));
CREATE POLICY message_templates_update ON message_templates FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY message_templates_delete ON message_templates FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- pipelines
CREATE POLICY pipelines_insert ON pipelines FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY pipelines_select ON pipelines FOR SELECT USING (is_account_member(account_id));
CREATE POLICY pipelines_update ON pipelines FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY pipelines_delete ON pipelines FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- pipeline_stages
CREATE POLICY pipeline_stages_modify ON pipeline_stages FOR ALL USING (EXISTS (SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum))));
CREATE POLICY pipeline_stages_select ON pipeline_stages FOR SELECT USING (EXISTS (SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id))));

-- deals
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY deals_select ON deals FOR SELECT USING (is_account_member(account_id));
CREATE POLICY deals_update ON deals FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY deals_delete ON deals FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- broadcasts
CREATE POLICY broadcasts_insert ON broadcasts FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY broadcasts_select ON broadcasts FOR SELECT USING (is_account_member(account_id));
CREATE POLICY broadcasts_update ON broadcasts FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY broadcasts_delete ON broadcasts FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- broadcast_recipients
CREATE POLICY broadcast_recipients_modify ON broadcast_recipients FOR ALL USING (EXISTS (SELECT 1 FROM broadcasts b WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM broadcasts b WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum))));
CREATE POLICY broadcast_recipients_select ON broadcast_recipients FOR SELECT USING (EXISTS (SELECT 1 FROM broadcasts b WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id))));

-- automations
CREATE POLICY automations_insert ON automations FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY automations_select ON automations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY automations_update ON automations FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY automations_delete ON automations FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- automation_steps
CREATE POLICY automation_steps_modify ON automation_steps FOR ALL USING (EXISTS (SELECT 1 FROM automations a WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM automations a WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum))));
CREATE POLICY automation_steps_select ON automation_steps FOR SELECT USING (EXISTS (SELECT 1 FROM automations a WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id))));

-- automation_logs
CREATE POLICY automation_logs_select ON automation_logs FOR SELECT USING (is_account_member(account_id));

-- message_reactions
CREATE POLICY message_reactions_modify ON message_reactions FOR ALL USING (EXISTS (SELECT 1 FROM (messages m JOIN conversations c ON ((c.id = m.conversation_id))) WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM (messages m JOIN conversations c ON ((c.id = m.conversation_id))) WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum))));
CREATE POLICY message_reactions_select ON message_reactions FOR SELECT USING (EXISTS (SELECT 1 FROM (messages m JOIN conversations c ON ((c.id = m.conversation_id))) WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id))));

-- flows
CREATE POLICY flows_insert ON flows FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY flows_select ON flows FOR SELECT USING (is_account_member(account_id));
CREATE POLICY flows_update ON flows FOR UPDATE USING (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY flows_delete ON flows FOR DELETE USING (is_account_member(account_id, 'agent'::account_role_enum));

-- flow_nodes
CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (EXISTS (SELECT 1 FROM flows f WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))) WITH CHECK (EXISTS (SELECT 1 FROM flows f WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum))));
CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (EXISTS (SELECT 1 FROM flows f WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id))));

-- flow_runs
CREATE POLICY flow_runs_select ON flow_runs FOR SELECT USING (is_account_member(account_id));

-- flow_run_events
CREATE POLICY flow_run_events_select ON flow_run_events FOR SELECT USING (EXISTS (SELECT 1 FROM flow_runs r WHERE ((r.id = flow_run_events.flow_run_id) AND is_account_member(r.account_id))));

-- accounts
CREATE POLICY accounts_select ON accounts FOR SELECT USING (is_account_member(id));
CREATE POLICY accounts_update ON accounts FOR UPDATE USING (is_account_member(id, 'admin'::account_role_enum)) WITH CHECK (is_account_member(id, 'admin'::account_role_enum));

-- account_invitations
CREATE POLICY account_invitations_select ON account_invitations FOR SELECT USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY account_invitations_modify ON account_invitations FOR ALL USING (is_account_member(account_id, 'admin'::account_role_enum)) WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));

-- member_presence
CREATE POLICY member_presence_select ON member_presence FOR SELECT USING (is_account_member(account_id));

-- api_keys
CREATE POLICY api_keys_insert ON api_keys FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY api_keys_select ON api_keys FOR SELECT USING (is_account_member(account_id));
CREATE POLICY api_keys_update ON api_keys FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY api_keys_delete ON api_keys FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- notifications
CREATE POLICY notifications_select ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_configs
CREATE POLICY ai_configs_insert ON ai_configs FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_configs_select ON ai_configs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ai_configs_update ON ai_configs FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_configs_delete ON ai_configs FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- ai_knowledge_documents
CREATE POLICY ai_knowledge_documents_insert ON ai_knowledge_documents FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_knowledge_documents_select ON ai_knowledge_documents FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ai_knowledge_documents_update ON ai_knowledge_documents FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_knowledge_documents_delete ON ai_knowledge_documents FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- ai_knowledge_chunks
CREATE POLICY ai_knowledge_chunks_insert ON ai_knowledge_chunks FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_knowledge_chunks_select ON ai_knowledge_chunks FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ai_knowledge_chunks_update ON ai_knowledge_chunks FOR UPDATE USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY ai_knowledge_chunks_delete ON ai_knowledge_chunks FOR DELETE USING (is_account_member(account_id, 'admin'::account_role_enum));

-- roles
CREATE POLICY roles_insert ON roles FOR INSERT WITH CHECK (is_account_member(account_id, 'owner'::account_role_enum));
CREATE POLICY roles_select ON roles FOR SELECT USING (is_account_member(account_id));
CREATE POLICY roles_update ON roles FOR UPDATE USING (is_account_member(account_id, 'owner'::account_role_enum)) WITH CHECK (is_account_member(account_id, 'owner'::account_role_enum));
CREATE POLICY roles_delete ON roles FOR DELETE USING (is_account_member(account_id, 'owner'::account_role_enum));

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_member_presence_account_id ON member_presence (account_id);
CREATE INDEX idx_flows_account_id ON flows (account_id);
CREATE INDEX idx_broadcasts_account_id ON broadcasts (account_id);
CREATE INDEX idx_tags_account_id ON tags (account_id);
CREATE INDEX idx_custom_fields_account_id ON custom_fields (account_id);
CREATE INDEX idx_message_templates_account_id ON message_templates (account_id);
CREATE INDEX idx_api_keys_account_id ON api_keys (account_id);
CREATE INDEX idx_flow_nodes_flow_id ON flow_nodes (flow_id);
CREATE INDEX idx_automations_account_id ON automations (account_id);
CREATE INDEX idx_account_invitations_account_id ON account_invitations (account_id);
CREATE INDEX idx_ai_configs_account_id ON ai_configs (account_id);
CREATE INDEX idx_whatsapp_config_account_id ON whatsapp_config (account_id);
CREATE INDEX idx_roles_account_id ON roles (account_id);
CREATE INDEX idx_pipelines_account_id ON pipelines (account_id);
CREATE INDEX idx_profiles_account_id ON profiles (account_id);
CREATE INDEX idx_contacts_account_id ON contacts (account_id);
CREATE INDEX idx_ai_knowledge_documents_account_id ON ai_knowledge_documents (account_id);
CREATE INDEX idx_conversations_account_id ON conversations (account_id);
CREATE INDEX idx_conversations_contact_id ON conversations (contact_id);
CREATE INDEX idx_contact_notes_account_id ON contact_notes (account_id);
CREATE INDEX idx_contact_notes_contact_id ON contact_notes (contact_id);
CREATE INDEX idx_automation_steps_automation_id ON automation_steps (automation_id);
CREATE INDEX idx_automation_steps_parent_step_id ON automation_steps (parent_step_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_reply_to_message_id ON messages (reply_to_message_id);
CREATE INDEX idx_contact_tags_contact_id ON contact_tags (contact_id);
CREATE INDEX idx_contact_tags_tag_id ON contact_tags (tag_id);
CREATE INDEX idx_contact_custom_values_contact_id ON contact_custom_values (contact_id);
CREATE INDEX idx_contact_custom_values_custom_field_id ON contact_custom_values (custom_field_id);
CREATE INDEX idx_ai_knowledge_chunks_account_id ON ai_knowledge_chunks (account_id);
CREATE INDEX idx_ai_knowledge_chunks_document_id ON ai_knowledge_chunks (document_id);
CREATE INDEX idx_notifications_account_id ON notifications (account_id);
CREATE INDEX idx_notifications_contact_id ON notifications (contact_id);
CREATE INDEX idx_notifications_conversation_id ON notifications (conversation_id);
CREATE INDEX idx_pipeline_stages_pipeline_id ON pipeline_stages (pipeline_id);
CREATE INDEX idx_flow_runs_account_id ON flow_runs (account_id);
CREATE INDEX idx_flow_runs_contact_id ON flow_runs (contact_id);
CREATE INDEX idx_flow_runs_conversation_id ON flow_runs (conversation_id);
CREATE INDEX idx_flow_runs_flow_id ON flow_runs (flow_id);
CREATE INDEX idx_flow_runs_last_prompt_message_id ON flow_runs (last_prompt_message_id);
CREATE INDEX idx_broadcast_recipients_broadcast_id ON broadcast_recipients (broadcast_id);
CREATE INDEX idx_broadcast_recipients_contact_id ON broadcast_recipients (contact_id);
CREATE INDEX idx_deals_account_id ON deals (account_id);
CREATE INDEX idx_deals_assigned_to ON deals (assigned_to);
CREATE INDEX idx_deals_contact_id ON deals (contact_id);
CREATE INDEX idx_deals_conversation_id ON deals (conversation_id);
CREATE INDEX idx_deals_pipeline_id ON deals (pipeline_id);
CREATE INDEX idx_deals_stage_id ON deals (stage_id);
CREATE INDEX idx_automation_logs_account_id ON automation_logs (account_id);
CREATE INDEX idx_automation_logs_automation_id ON automation_logs (automation_id);
CREATE INDEX idx_automation_logs_contact_id ON automation_logs (contact_id);
CREATE INDEX idx_flow_run_events_flow_run_id ON flow_run_events (flow_run_id);
CREATE INDEX idx_message_reactions_conversation_id ON message_reactions (conversation_id);
CREATE INDEX idx_message_reactions_message_id ON message_reactions (message_id);
CREATE INDEX idx_automation_pending_executions_account_id ON automation_pending_executions (account_id);
CREATE INDEX idx_automation_pending_executions_automation_id ON automation_pending_executions (automation_id);
CREATE INDEX idx_automation_pending_executions_contact_id ON automation_pending_executions (contact_id);
CREATE INDEX idx_automation_pending_executions_log_id ON automation_pending_executions (log_id);
CREATE INDEX idx_automation_pending_executions_parent_step_id ON automation_pending_executions (parent_step_id);

-- FTS index on ai_knowledge_chunks
CREATE INDEX idx_ai_knowledge_chunks_fts ON ai_knowledge_chunks USING gin (fts);

-- ===========================================
-- BACKFILL: populate computed columns for existing data
-- ===========================================

UPDATE contacts SET phone_normalized = regexp_replace(phone, '\D', '', 'g') WHERE phone_normalized IS NULL;
UPDATE ai_knowledge_chunks SET fts = to_tsvector('simple', COALESCE(content, '')) WHERE fts IS NULL;
