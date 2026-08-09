# Retired migrations

`202608030001_v0313_demo_installer_membership.sql` was not applied to Production. A read-only Production audit on 2026-08-09 confirmed that its table, RPC, index, and policies were absent.

This migration is intentionally excluded from the active migration chain and must not be marked as applied with `migration repair --status applied`.
