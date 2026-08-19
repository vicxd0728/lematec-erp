-- Allow the Cloudflare Worker service role to read the public video library.
grant usage on schema public to service_role;
grant select on public.video_library_public to service_role;
grant select on public.erp_video_library to service_role;
