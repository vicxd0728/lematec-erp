alter table public.pick_lists
  drop constraint if exists pick_lists_status_check;

alter table public.pick_lists
  add constraint pick_lists_status_check
  check (status in ('待確認', '待領料', '已領料', '已確認扣料', '缺料待補', '待回料確認', '取消', '已沖銷', '已退料'));
