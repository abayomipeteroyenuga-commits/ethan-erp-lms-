-- ETHAN LEARN v11.0: company bank accounts and Admin payment verification.
-- Applied to the ETHAN ERP LMS Neon project on 2026-11-10.

CREATE TABLE IF NOT EXISTS public.payment_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_bank_accounts_nonblank CHECK (
    length(trim(bank_name)) > 0 AND
    length(trim(account_name)) > 0 AND
    length(trim(account_number)) > 0
  )
);

ALTER TABLE public.payment_bank_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_bank_accounts TO authenticated;

CREATE POLICY "active payment bank accounts read"
  ON public.payment_bank_accounts FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "admins manage payment bank accounts"
  ON public.payment_bank_accounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.course_access_requests
  ADD COLUMN IF NOT EXISTS bank_account_id uuid
  REFERENCES public.payment_bank_accounts(id) ON DELETE SET NULL;

CREATE POLICY "admins read course access requests"
  ON public.course_access_requests FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.approve_course_access_request(
  p_request_id uuid,
  p_admin_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request public.course_access_requests%ROWTYPE;
  v_course_title text;
  v_course_fee numeric;
  v_payment_id uuid;
  v_internal_reference text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an authorised Admin or Super Admin can verify payment and approve course access.';
  END IF;
  SELECT * INTO v_request
  FROM public.course_access_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course access request not found.'; END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This course access request has already been reviewed.';
  END IF;
  SELECT title, fee INTO v_course_title, v_course_fee
  FROM public.courses
  WHERE id = v_request.course_id AND published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'The requested course is no longer published.'; END IF;
  IF v_request.amount <> v_course_fee OR v_course_fee <= 0 THEN
    RAISE EXCEPTION 'The submitted amount no longer matches the course fee. Review the request before approval.';
  END IF;
  v_internal_reference := 'EDA-COURSE-' || upper(substr(replace(v_request.id::text, '-', ''), 1, 20));
  INSERT INTO public.payments(reference, student_id, description, amount, method, verified, verified_by, paid_at)
  VALUES (
    v_internal_reference,
    v_request.student_id,
    v_course_title || ' — transfer ref: ' || v_request.payment_reference,
    v_request.amount,
    v_request.payment_method,
    true,
    auth.uid(),
    v_request.payment_date::timestamptz
  )
  RETURNING id INTO v_payment_id;
  INSERT INTO public.enrolments(student_id, course_id, status)
  VALUES(v_request.student_id, v_request.course_id, 'active')
  ON CONFLICT(student_id, course_id) DO UPDATE
    SET status = 'active', enrolled_at = now(), completed_at = NULL;
  UPDATE public.course_access_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_note = NULLIF(trim(coalesce(p_admin_note, '')), ''),
      payment_id = v_payment_id
  WHERE id = p_request_id;
  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', 'approved',
    'payment_id', v_payment_id,
    'course_id', v_request.course_id,
    'course_title', v_course_title,
    'student_id', v_request.student_id,
    'amount', v_request.amount
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_course_access_request(
  p_request_id uuid,
  p_admin_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_request public.course_access_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an authorised Admin or Super Admin can review course access requests.';
  END IF;
  SELECT * INTO v_request
  FROM public.course_access_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course access request not found.'; END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This course access request has already been reviewed.';
  END IF;
  UPDATE public.course_access_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_note = NULLIF(trim(coalesce(p_admin_note, '')), '')
  WHERE id = p_request_id;
  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_course_access_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_course_access_request(uuid, text) TO authenticated;
