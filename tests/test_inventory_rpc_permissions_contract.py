from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20260731_014_inventory_transaction_rpc_permissions.sql"
)


def test_inventory_rpc_permission_repair_is_complete():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "grant select, insert on public.inventory_transactions to service_role" in sql
    assert "alter function public.apply_inventory_transaction" in sql
    assert "alter function public.apply_inventory_batch" in sql
    assert sql.count("owner to postgres") == 2
    assert sql.count("to authenticated, service_role") == 2
    assert "from public, anon" in sql
