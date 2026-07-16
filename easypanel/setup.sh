#!/bin/bash
# =============================================================================
# Quick setup script for Easypanel deployment
# =============================================================================
# Usage:
#   cd wacrm/easypanel
#   chmod +x setup.sh
#   ./setup.sh
# =============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  NEXIA-CRM + Supabase — Easypanel Setup                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Generate credentials ─────────────────────────────────────────────
echo "▸ Paso 1: Generando credenciales de Supabase..."
cd ..
python3 generate_supabase_env.py
cd easypanel

echo ""
echo "✓ Credenciales generadas en ../.env y ../credentials.txt"
echo ""

# ── Step 2: Copy .env for reference ──────────────────────────────────────────
echo "▸ Paso 2: Creando .env.supabase para referencia..."
cp ../.env .env.supabase 2>/dev/null || true
echo "✓ .env.supabase creado"
echo ""

# ── Step 3: Instructions ─────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Siguientes pasos en Easypanel:                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                             ║"
echo "║  1. Crear servicio 'supabase' (Docker Compose)              ║"
echo "║     - Subir: docker-compose.supabase.yml                   ║"
echo "║     - Copiar variables de .env.supabase                    ║"
echo "║     - Dominio: db.tudominio.com → puerto 8000              ║"
echo "║                                                             ║"
echo "║  2. Crear servicio 'nexia-crm' (Docker)                    ║"
echo "║     - Build desde Dockerfile del repo                      ║"
echo "║     - Variables del CRM (ver .env.supabase.example)        ║"
echo "║     - Dominio: crm.tudominio.com → puerto 3000             ║"
echo "║                                                             ║"
echo "║  3. Ejecutar migraciones en Supabase Studio                ║"
echo "║     - URL: https://studio.tudominio.com                    ║"
echo "║     - SQL: ../schema_generated.sql                          ║"
echo "║                                                             ║"
echo "║  4. Configurar webhook de WhatsApp en Meta                  ║"
echo "║     - URL: https://crm.tudominio.com/api/whatsapp/webhook  ║"
echo "║                                                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📖 Documentación completa: docs/deployment-easypanel.md"
echo ""
