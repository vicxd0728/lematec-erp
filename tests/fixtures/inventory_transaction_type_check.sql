-- Schema contract from 20260717_001_initial_erp_schema.sql, inventory_transactions.
-- Test fixture only. Production installation verifies pg_constraint read-only.
constraint inventory_transaction_type_check check (transaction_type in ('入料入庫','領料扣除','C端出貨','生產完成','取消回料','盤點調整','手動調整','合併料號','其他'))
