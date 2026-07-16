#!/usr/bin/env python3
"""
Genera .env para Supabase self-hosted y un archivo credentials.txt
con el resumen de todas las credenciales.

Cada campo se genera siguiendo la regla indicada en los comentarios
del .env original de Supabase.

Uso:
    python3 generate_supabase_env.py
"""

import secrets
import base64
import json
import time
import hashlib
import subprocess
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

# ---------------------------------------------------------------------------
# Helpers que replican exactamente los comandos openssl del .env
# ---------------------------------------------------------------------------

def openssl_rand_base64(n_bytes: int) -> str:
    """openssl rand -base64 <n_bytes>"""
    return base64.b64encode(secrets.token_bytes(n_bytes)).decode()

def openssl_rand_hex(n_bytes: int) -> str:
    """openssl rand -hex <n_bytes>"""
    return secrets.token_hex(n_bytes)

# ---------------------------------------------------------------------------
# ES256 (ECDSA P-256) key pair + JWK / JWKS
# ---------------------------------------------------------------------------

def _int_to_b64url(n: int) -> str:
    byte_len = (n.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(n.to_bytes(byte_len, "big")).rstrip(b"=").decode()

def ec_private_key_to_jwk(private_key, kid: str) -> dict:
    priv_numbers = private_key.private_numbers()
    pub_numbers = private_key.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "x": _int_to_b64url(pub_numbers.x),
        "y": _int_to_b64url(pub_numbers.y),
        "d": _int_to_b64url(priv_numbers.private_value),
        "alg": "ES256",
        "use": "sig",
    }

def ec_public_key_to_jwk(public_key, kid: str) -> dict:
    pub_numbers = public_key.public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "x": _int_to_b64url(pub_numbers.x),
        "y": _int_to_b64url(pub_numbers.y),
        "alg": "ES256",
        "use": "sig",
    }

def symmetric_jwk_from_secret(secret: str, kid: str) -> dict:
    return {
        "kty": "oct",
        "kid": kid,
        "k": base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode(),
        "alg": "HS256",
        "use": "sig",
    }

def generate_ec_keypair():
    """Generate an EC P-256 key pair."""
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()
    return private_key, public_key

# ---------------------------------------------------------------------------
# JWT generation (HS256 legacy + ES256 asymmetric)
# ---------------------------------------------------------------------------

def generate_hs256_jwt(role: str, secret: str, iss: str = "supabase-demo") -> str:
    """HS256-signed JWT (legacy API key)."""
    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "role": role,
        "iss": iss,
        "iat": now,
        "exp": now + 315360000,  # ~10 years
    }
    h = b64url(json.dumps(header, separators=(",", ":")).encode())
    p = b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig_input = f"{h}.{p}".encode()
    import hmac as _hmac, hashlib as _hashlib
    sig = _hmac.new(secret.encode(), sig_input, _hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"

def generate_es256_jwt(role: str, private_key, kid: str, iss: str = "supabase-demo") -> str:
    """ES256-signed JWT (asymmetric API key)."""
    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = {"alg": "ES256", "typ": "JWT", "kid": kid}
    now = int(time.time())
    payload = {
        "role": role,
        "iss": iss,
        "iat": now,
        "exp": now + 315360000,  # ~10 years
    }
    h = b64url(json.dumps(header, separators=(",", ":")).encode())
    p = b64url(json.dumps(payload, separators=(",", ":")).encode())
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    sig_der = private_key.sign(
        f"{h}.{p}".encode(),
        ec.ECDSA(hashes.SHA256()),
    )
    r, s = decode_dss_signature(sig_der)
    r_bytes = r.to_bytes(32, "big")
    s_bytes = s.to_bytes(32, "big")
    sig = b64url(r_bytes + s_bytes)
    return f"{h}.{p}.{sig}"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    out_dir = Path(".")

    # ---- Secrets (exactamente como lo haría openssl) ----
    POSTGRES_PASSWORD = openssl_rand_hex(32)                 # 64 hex chars
    JWT_SECRET = secrets.token_urlsafe(48)                   # ≥32 chars

    # ES256 key pair (used for JWT_KEYS, JWT_JWKS, ANON_KEY_ASYMMETRIC, SERVICE_ROLE_KEY_ASYMMETRIC)
    ec_private, ec_public = generate_ec_keypair()
    ec_kid = hashlib.sha256(ec_private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )).hexdigest()[:16]

    # Legacy HS256 JWTs
    ANON_KEY = generate_hs256_jwt("anon", JWT_SECRET)
    SERVICE_ROLE_KEY = generate_hs256_jwt("service_role", JWT_SECRET)

    # ES256 asymmetric JWTs
    ANON_KEY_ASYMMETRIC = generate_es256_jwt("anon", ec_private, ec_kid)
    SERVICE_ROLE_KEY_ASYMMETRIC = generate_es256_jwt("service_role", ec_private, ec_kid)

    # Opaque API keys
    SUPABASE_PUBLISHABLE_KEY = f"sb_publishable_{openssl_rand_hex(20)}"
    SUPABASE_SECRET_KEY = f"sb_secret_{openssl_rand_hex(24)}"

    # JWKS: JWT_KEYS = EC private (for Auth) + HS256 symmetric
    #        JWT_JWKS = EC public (for PostgREST/Realtime/Storage) + HS256 symmetric
    ec_priv_jwk = ec_private_key_to_jwk(ec_private, ec_kid)
    ec_pub_jwk = ec_public_key_to_jwk(ec_public, ec_kid)
    hs_sym_jwk_priv = symmetric_jwk_from_secret(JWT_SECRET, "hs256-legacy")
    hs_sym_jwk_pub = symmetric_jwk_from_secret(JWT_SECRET, "hs256-legacy")

    JWT_KEYS = json.dumps([ec_priv_jwk, hs_sym_jwk_priv], separators=(",", ":"))
    JWT_JWKS = json.dumps([ec_pub_jwk, hs_sym_jwk_pub], separators=(",", ":"))

    # Dashboard
    DASHBOARD_PASSWORD = secrets.token_urlsafe(16)

    # Realtime / Supavisor / Studio encryption keys
    SECRET_KEY_BASE = openssl_rand_base64(48)                # ≥64 chars
    REALTIME_DB_ENC_KEY = openssl_rand_hex(8)                # exactly 16 hex chars
    VAULT_ENC_KEY = openssl_rand_hex(16)                     # exactly 32 hex chars
    PG_META_CRYPTO_KEY = openssl_rand_base64(24)             # ≥32 chars

    # Logflare tokens
    LOGFLARE_PUBLIC_ACCESS_TOKEN = openssl_rand_base64(24)   # ≥32 chars
    LOGFLARE_PRIVATE_ACCESS_TOKEN = openssl_rand_base64(24)  # ≥32 chars

    # S3 Storage
    S3_PROTOCOL_ACCESS_KEY_ID = openssl_rand_hex(16)         # 32 hex chars
    S3_PROTOCOL_ACCESS_KEY_SECRET = openssl_rand_hex(32)     # 64 hex chars

    # Pooler
    POOLER_TENANT_ID = f"pool_{openssl_rand_hex(8)}"

    # MinIO
    MINIO_ROOT_PASSWORD = openssl_rand_hex(16)               # 8+ chars

    # ---- .env ----
    env_content = f"""############
# Docker compose override files to layer on top of docker-compose.yml.
# Native docker compose COMPOSE_FILE: colon-separated list, base file first.
# Manage with: ./run.sh config add|remove <name>
#
# Examples:
#   COMPOSE_FILE=docker-compose.yml
#   COMPOSE_FILE=docker-compose.yml:docker-compose.pg17.yml
#
############
COMPOSE_FILE=docker-compose.yml


############
# Secrets
#
# Auto-generated — DO NOT commit to version control
#
############

# Postgres
POSTGRES_PASSWORD={POSTGRES_PASSWORD}

# Legacy symmetric HS256 key
JWT_SECRET={JWT_SECRET}
# Legacy API keys (HS256-signed JWTs)
ANON_KEY={ANON_KEY}
SERVICE_ROLE_KEY={SERVICE_ROLE_KEY}

# Asymmetric key pair (ES256) and opaque API keys
SUPABASE_PUBLISHABLE_KEY={SUPABASE_PUBLISHABLE_KEY}
SUPABASE_SECRET_KEY={SUPABASE_SECRET_KEY}
JWT_KEYS={JWT_KEYS}
JWT_JWKS={JWT_JWKS}

# Access to Dashboard
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD={DASHBOARD_PASSWORD}

# Encryption key for securing Realtime and Supavisor communications.
SECRET_KEY_BASE={SECRET_KEY_BASE}

# Encryption key used by Realtime for sensitive fields in the `_realtime` schema.
REALTIME_DB_ENC_KEY={REALTIME_DB_ENC_KEY}

# Encryption key used by Supavisor for storing encrypted configuration.
VAULT_ENC_KEY={VAULT_ENC_KEY}

# Encryption key for securing connection strings used by Studio against postgres-meta.
PG_META_CRYPTO_KEY={PG_META_CRYPTO_KEY}

# API token for log ingestion used by Logflare and Vector.
LOGFLARE_PUBLIC_ACCESS_TOKEN={LOGFLARE_PUBLIC_ACCESS_TOKEN}
# API token used for Logflare management operations.
LOGFLARE_PRIVATE_ACCESS_TOKEN={LOGFLARE_PRIVATE_ACCESS_TOKEN}

# Access key ID for accessing the S3 protocol endpoint in Storage.
S3_PROTOCOL_ACCESS_KEY_ID={S3_PROTOCOL_ACCESS_KEY_ID}
# Secret key used with S3_PROTOCOL_ACCESS_KEY_ID.
S3_PROTOCOL_ACCESS_KEY_SECRET={S3_PROTOCOL_ACCESS_KEY_SECRET}


############
# URLs
############
SUPABASE_PUBLIC_URL=http://localhost:8000
API_EXTERNAL_URL=http://localhost:8000/auth/v1


############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432


############
# Supavisor
############
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID={POOLER_TENANT_ID}
POOLER_DB_POOL_SIZE=5


############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project
OPENAI_API_KEY=sk-proj-xxxxxxxx


############
# Auth
############
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false

MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=false

ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true


############
# Storage
############
GLOBAL_S3_BUCKET=stub
REGION=stub
MINIO_ROOT_USER=supa-storage
MINIO_ROOT_PASSWORD={MINIO_ROOT_PASSWORD}
STORAGE_TENANT_ID=stub


############
# Functions
############
FUNCTIONS_VERIFY_JWT=false


############
# API (PostgREST)
############
PGRST_DB_SCHEMAS=public,graphql_public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public


############
# Logs and Analytics
############
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER


############
# Kong
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
ANON_KEY_ASYMMETRIC={ANON_KEY_ASYMMETRIC}
SERVICE_ROLE_KEY_ASYMMETRIC={SERVICE_ROLE_KEY_ASYMMETRIC}


############
# imgproxy
############
IMGPROXY_AUTO_WEBP=true


############
# TLS Proxy
############
PROXY_DOMAIN=your-domain.example.com
CERTBOT_EMAIL=admin@example.com
"""
    env_path = out_dir / ".env"
    env_path.write_text(env_content)

    # ---- credentials.txt ----
    sep = "=" * 60
    dash = "-" * 60
    ts = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())

    txt = f"""{sep}
           SUPABASE CREDENTIALS SUMMARY
           Generated: {ts}
{sep}

POSTGRES
  Password ........................ {POSTGRES_PASSWORD}

JWT SECRET (HS256) ................ {JWT_SECRET}

LEGACY API KEYS (HS256)
  ANON_KEY ....................... {ANON_KEY}
  SERVICE_ROLE_KEY ............... {SERVICE_ROLE_KEY}

ES256 KEY PAIR
  KID ............................. {ec_kid}
  ANON_KEY_ASYMMETRIC ............ {ANON_KEY_ASYMMETRIC}
  SERVICE_ROLE_KEY_ASYMMETRIC .... {SERVICE_ROLE_KEY_ASYMMETRIC}

OPAQUE API KEYS
  SUPABASE_PUBLISHABLE_KEY ....... {SUPABASE_PUBLISHABLE_KEY}
  SUPABASE_SECRET_KEY ............ {SUPABASE_SECRET_KEY}

DASHBOARD
  Username ....................... supabase
  Password ....................... {DASHBOARD_PASSWORD}

ENCRYPTION KEYS
  SECRET_KEY_BASE ............... {SECRET_KEY_BASE}
  REALTIME_DB_ENC_KEY ........... {REALTIME_DB_ENC_KEY}  (16 chars)
  VAULT_ENC_KEY ................. {VAULT_ENC_KEY}  (32 chars)
  PG_META_CRYPTO_KEY ............ {PG_META_CRYPTO_KEY}

LOGFLARE
  PUBLIC_ACCESS_TOKEN ........... {LOGFLARE_PUBLIC_ACCESS_TOKEN}
  PRIVATE_ACCESS_TOKEN .......... {LOGFLARE_PRIVATE_ACCESS_TOKEN}

S3 STORAGE
  ACCESS_KEY_ID ................. {S3_PROTOCOL_ACCESS_KEY_ID}
  ACCESS_KEY_SECRET ............. {S3_PROTOCOL_ACCESS_KEY_SECRET}

POOLER
  TENANT_ID ..................... {POOLER_TENANT_ID}

MINIO
  ROOT_PASSWORD ................. {MINIO_ROOT_PASSWORD}

{sep}
  ⚠  DO NOT share or commit this file
{sep}
"""
    txt_path = out_dir / "credentials.txt"
    txt_path.write_text(txt)

    print(f"[OK]  .env         -> {env_path.resolve()}")
    print(f"[OK]  credentials  -> {txt_path.resolve()}")
    print()
    print("Siguientes pasos:")
    print("  1. Revisa .env y ajusta SMTP / dominio / OPENAI si es necesario")
    print("  2. docker compose up -d")

if __name__ == "__main__":
    main()
