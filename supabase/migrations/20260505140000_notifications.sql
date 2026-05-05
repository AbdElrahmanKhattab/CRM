-- Phase 09: Notifications table + RLS + trigger

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast unread queries
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid() AND company_id = current_user_company_id());

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (company_id = current_user_company_id());

CREATE POLICY "Users mark own notifications read" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- Trigger: auto-create notification when a visit is inserted
CREATE OR REPLACE FUNCTION notify_on_visit_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_rep_name TEXT;
  v_supervisor_id UUID;
  v_manager_ids UUID[];
BEGIN
  -- Get client name
  SELECT name_ar INTO v_client_name FROM clients WHERE id = NEW.client_id;
  IF v_client_name IS NULL THEN
    SELECT COALESCE(target_client_name, name_ar) INTO v_client_name FROM prospects WHERE id = NEW.prospect_id;
  END IF;
  v_client_name := COALESCE(v_client_name, 'عميل غير محدد');

  -- Get rep name
  SELECT full_name INTO v_rep_name FROM user_profiles WHERE id = NEW.rep_id;

  -- Get supervisor (manager_id of the rep)
  SELECT manager_id INTO v_supervisor_id FROM user_profiles WHERE id = NEW.rep_id;

  -- Notify supervisor about visit
  IF v_supervisor_id IS NOT NULL THEN
    INSERT INTO notifications (company_id, user_id, type, title, body, data)
    VALUES (
      NEW.company_id,
      v_supervisor_id,
      'visit_logged',
      'زيارة جديدة',
      v_rep_name || ' سجّل زيارة لـ ' || v_client_name,
      jsonb_build_object('visit_id', NEW.id, 'client_id', NEW.client_id, 'rep_id', NEW.rep_id)
    );
  END IF;

  -- Notify managers/owners about large collections (> 5000 SAR)
  IF NEW.collection_amount > 5000 THEN
    FOR v_supervisor_id IN
      SELECT id FROM user_profiles
      WHERE company_id = NEW.company_id AND role IN ('manager', 'owner') AND is_active = true
    LOOP
      INSERT INTO notifications (company_id, user_id, type, title, body, data)
      VALUES (
        NEW.company_id,
        v_supervisor_id,
        'large_collection',
        'تحصيل كبير',
        'تم تحصيل ' || NEW.collection_amount || ' ر.س من ' || v_client_name,
        jsonb_build_object('visit_id', NEW.id, 'client_id', NEW.client_id, 'amount', NEW.collection_amount)
      );
    END LOOP;
  END IF;

  -- Notify supervisor about zero GPS visits
  IF (NEW.check_in_lat IS NULL OR NEW.check_in_lat = 0) AND (NEW.check_in_lng IS NULL OR NEW.check_in_lng = 0) THEN
    IF v_supervisor_id IS NOT NULL THEN
      -- Re-fetch supervisor since we reused the variable
      SELECT manager_id INTO v_supervisor_id FROM user_profiles WHERE id = NEW.rep_id;
      IF v_supervisor_id IS NOT NULL THEN
        INSERT INTO notifications (company_id, user_id, type, title, body, data)
        VALUES (
          NEW.company_id,
          v_supervisor_id,
          'zero_gps',
          'زيارة بدون GPS',
          'زيارة بدون موقع GPS: ' || v_rep_name || ' → ' || v_client_name,
          jsonb_build_object('visit_id', NEW.id, 'rep_id', NEW.rep_id)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_visit
AFTER INSERT ON visits
FOR EACH ROW
EXECUTE FUNCTION notify_on_visit_insert();
