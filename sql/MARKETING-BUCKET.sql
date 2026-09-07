-- ============================================================================
-- MARKETING-BUCKET.sql — widen sbv-operator-media for marketing-kit artifacts
-- ----------------------------------------------------------------------------
-- The bucket was created for operator photo uploads (jpeg/png/webp, 2MB).
-- api/marketing-kit.mjs uploads a Letter flyer PDF (application/pdf) and
-- render PNGs that can exceed 2MB (the Prime reference flyer PNG is 2.03MB),
-- so the service-role upload was refused: 415 invalid_mime_type on the PDF,
-- and the size ceiling was one large render away from a 413.
--
-- ADDITIVE ONLY: every previously allowed type stays allowed, the limit only
-- rises, and the photo upload path (admin -> storage, image/*) is unchanged.
-- Idempotent. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'],
       file_size_limit    = 10485760
 where id = 'sbv-operator-media';

-- ================================================ VERIFY (one row) ==
select id,
       allowed_mime_types,
       file_size_limit,
       (allowed_mime_types @> array['application/pdf'])::text as pdf_allowed,
       (file_size_limit = 10485760)::text as limit_10mb
  from storage.buckets
 where id = 'sbv-operator-media';
