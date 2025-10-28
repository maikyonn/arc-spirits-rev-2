alter table "arc-spirits-rev2".units rename to hex_spirits;

alter table "arc-spirits-rev2".hex_spirits rename constraint units_pkey to hex_spirits_pkey;
alter table "arc-spirits-rev2".hex_spirits rename constraint units_name_class_id_origin_id_key to hex_spirits_name_class_id_origin_id_key;
alter table "arc-spirits-rev2".hex_spirits rename constraint units_origin_id_fkey to hex_spirits_origin_id_fkey;
alter table "arc-spirits-rev2".hex_spirits rename constraint units_class_id_fkey to hex_spirits_class_id_fkey;
alter table "arc-spirits-rev2".hex_spirits rename constraint units_cost_check to hex_spirits_cost_check;
