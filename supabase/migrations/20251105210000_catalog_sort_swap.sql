-- swap de sort_index entre dos filas del catálogo (atómico por transacción)
create or replace function public.swap_catalog_sort(
  a_id bigint, a_sort int,
  b_id bigint, b_sort int
) returns void
language plpgsql
as $$
begin
  update public.catalog_items set sort_index = b_sort where id = a_id;
  update public.catalog_items set sort_index = a_sort where id = b_id;
end;
$$;

