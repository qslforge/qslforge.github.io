-- System programs for v1. Extend via configuration, not code.
-- Reference formats:
--   POTA: verified via api.pota.app (Belgium = BE-0001 style, 2026-11-27)
--   WWFF: ONFF-0599 style for Belgium, generic <prefix>FF-<4 digits>
--   SOTA: ON/ON-001 style
--   BOTA, COTA: format still to verify in phase 1, so no regex yet (NULL = no validation)

INSERT INTO programs (code, name, ref_regex, adif_my_field, adif_sig, adif_their_field, hashtags, dupe_window) VALUES
  ('POTA', 'Parks on the Air',          '^[A-Z0-9]{1,4}-[0-9]{4,5}$',          'MY_POTA_REF', NULL,   'POTA_REF', '["#POTA","#ParksOnTheAir"]', 'utc_day'),
  ('WWFF', 'World Wide Flora & Fauna',  '^[A-Z0-9]{1,4}FF-[0-9]{4}$',          'MY_WWFF_REF', NULL,   'WWFF_REF', '["#WWFF","#ONFF"]',          'activation'),
  ('SOTA', 'Summits on the Air',        '^[A-Z0-9]{1,4}/[A-Z0-9]{2}-[0-9]{3}$', 'MY_SOTA_REF', NULL,   'SOTA_REF', '["#SOTA"]',                  'utc_day'),
  ('BOTA', 'Bunkers on the Air',        NULL,                                  NULL,          'BOTA', NULL,       '["#BOTA"]',                  'utc_day'),
  ('COTA', 'Castles on the Air',        NULL,                                  NULL,          'COTA', NULL,       '["#COTA"]',                  'utc_day');
