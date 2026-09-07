/**
 * Idempotent database objects (extensions, functions, triggers) that must
 * exist for the application to behave correctly. These are applied on every
 * server start (see `src/instrumentation.ts`) using `CREATE ... OR REPLACE`
 * / `IF NOT EXISTS` semantics so they are always safe to re-run.
 *
 * The most important object here is `consume_food_token`, the atomic
 * PostgreSQL function that guarantees a QR food token can be consumed
 * exactly once even if multiple scanner devices hit it at the same instant.
 */
export const BOOTSTRAP_SQL = `
-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep updated_at fresh on students
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_set_updated_at ON students;
CREATE TRIGGER students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Notify listeners (SSE endpoint) whenever a scan happens or a student
-- token changes state. Used to power realtime sync across scanner devices
-- and the admin dashboard without polling the database.
CREATE OR REPLACE FUNCTION notify_scan_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'scan_events',
    json_build_object(
      'type', 'SCAN',
      'scan_result', NEW.scan_result,
      'student_id', NEW.student_id,
      'scanner_name', NEW.scanner_name,
      'scanned_at', NEW.scanned_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scan_logs_notify ON scan_logs;
CREATE TRIGGER scan_logs_notify
AFTER INSERT ON scan_logs
FOR EACH ROW EXECUTE FUNCTION notify_scan_event();

CREATE OR REPLACE FUNCTION notify_student_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'scan_events',
    json_build_object(
      'type', 'STUDENT_UPDATE',
      'student_id', NEW.id,
      'qr_status', NEW.qr_status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_notify ON students;
CREATE TRIGGER students_notify
AFTER INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION notify_student_event();

-- ---------------------------------------------------------------------
-- ATOMIC FOOD TOKEN CONSUMPTION
--
-- This is the single most important function in the system. It is the
-- ONLY way a QR token may transition from UNUSED -> USED. The row lock
-- (FOR UPDATE) combined with running entirely inside one statement's
-- implicit transaction guarantees that if two scanner devices call this
-- function for the same token at the same instant, PostgreSQL serializes
-- the two calls: only one can observe qr_status = 'UNUSED' and win.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_food_token(
  p_token_hash TEXT,
  p_scanner_user_id UUID,
  p_scanner_name TEXT
)
RETURNS TABLE (
  result TEXT,
  out_student_id UUID,
  out_college_type TEXT,
  out_college_name TEXT,
  out_phone_last4 TEXT,
  out_scanned_at TIMESTAMPTZ,
  out_prev_scanned_at TIMESTAMPTZ,
  out_prev_scanner_name TEXT
) AS $$
DECLARE
  v_student students%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_prev_scanned_at TIMESTAMPTZ;
  v_prev_scanner_name TEXT;
BEGIN
  -- Lock the matching row (if any) for the duration of this statement.
  SELECT * INTO v_student
  FROM students
  WHERE qr_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO scan_logs (student_id, scanner_user_id, scanner_name, scan_result)
    VALUES (NULL, p_scanner_user_id, p_scanner_name, 'INVALID_TOKEN');

    RETURN QUERY SELECT
      'INVALID_TOKEN'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  IF v_student.qr_status = 'USED' THEN
    SELECT scanned_at, scanner_name
    INTO v_prev_scanned_at, v_prev_scanner_name
    FROM scan_logs
    WHERE student_id = v_student.id AND scan_result = 'SUCCESS'
    ORDER BY scanned_at DESC
    LIMIT 1;

    INSERT INTO scan_logs (student_id, scanner_user_id, scanner_name, scan_result)
    VALUES (v_student.id, p_scanner_user_id, p_scanner_name, 'ALREADY_USED');

    RETURN QUERY SELECT
      'ALREADY_USED'::TEXT, v_student.id, v_student.college_type::TEXT, v_student.college_name,
      v_student.phone_last4, NULL::TIMESTAMPTZ, v_prev_scanned_at, v_prev_scanner_name;
    RETURN;
  END IF;

  UPDATE students
  SET qr_status = 'USED', updated_at = v_now
  WHERE id = v_student.id;

  INSERT INTO scan_logs (student_id, scanner_user_id, scanner_name, scan_result, scanned_at)
  VALUES (v_student.id, p_scanner_user_id, p_scanner_name, 'SUCCESS', v_now);

  RETURN QUERY SELECT
    'SUCCESS'::TEXT, v_student.id, v_student.college_type::TEXT, v_student.college_name,
    v_student.phone_last4, v_now, NULL::TIMESTAMPTZ, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;
`;
