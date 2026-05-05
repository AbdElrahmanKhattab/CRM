-- Create dismissed_alerts table
CREATE TABLE IF NOT EXISTS dismissed_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, alert_type, reference_id)
);

ALTER TABLE dismissed_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dismissed alerts" ON dismissed_alerts
  FOR ALL USING (company_id = current_user_company_id() AND user_id = auth.uid());


-- Helper to check if alert is dismissed
CREATE OR REPLACE FUNCTION is_alert_dismissed(p_user_id UUID, p_type VARCHAR, p_ref_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM dismissed_alerts
    WHERE user_id = p_user_id
      AND alert_type = p_type
      AND reference_id = p_ref_id
      AND dismissed_at > NOW() - INTERVAL '7 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Overdue visits RPC
CREATE OR REPLACE FUNCTION get_overdue_visits(p_company_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  reference_id UUID,
  title TEXT,
  subtitle TEXT,
  days_count INTEGER,
  assigned_to TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id as id,
    'overdue_visit'::TEXT as alert_type,
    v.id as reference_id,
    c.name_ar::TEXT as title,
    'زيارة متأخرة'::TEXT as subtitle,
    (CURRENT_DATE - v.next_appointment::date)::INTEGER as days_count,
    u.full_name::TEXT as assigned_to
  FROM visits v
  JOIN clients c ON v.client_id = c.id
  JOIN user_profiles u ON v.rep_id = u.id
  WHERE v.company_id = p_company_id
    AND v.next_appointment IS NOT NULL 
    AND v.next_appointment::date < CURRENT_DATE
    AND NOT is_alert_dismissed(p_user_id, 'overdue_visit', v.id)
    AND NOT EXISTS (
      SELECT 1 FROM visits v2
      WHERE v2.client_id = v.client_id
        AND v2.check_in_time::date >= v.next_appointment::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Inactive clients RPC
CREATE OR REPLACE FUNCTION get_inactive_clients(p_company_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  reference_id UUID,
  title TEXT,
  subtitle TEXT,
  days_count INTEGER,
  assigned_to TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as id,
    'inactive_client'::TEXT as alert_type,
    c.id as reference_id,
    c.name_ar::TEXT as title,
    'عميل غير نشط'::TEXT as subtitle,
    EXTRACT(DAY FROM (CURRENT_DATE - COALESCE(MAX(v.check_in_time), c.created_at)))::INTEGER as days_count,
    u.full_name::TEXT as assigned_to
  FROM clients c
  LEFT JOIN (SELECT * FROM visits WHERE visits.status = 'completed') v ON c.id = v.client_id
  LEFT JOIN user_profiles u ON c.assigned_rep_id = u.id
  WHERE c.company_id = p_company_id AND c.is_active = true
    AND NOT is_alert_dismissed(p_user_id, 'inactive_client', c.id)
  GROUP BY c.id, c.name_ar, c.created_at, u.full_name
  HAVING MAX(v.check_in_time) IS NULL 
      OR MAX(v.check_in_time) < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Prospect followups RPC
CREATE OR REPLACE FUNCTION get_prospect_followups(p_company_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  reference_id UUID,
  title TEXT,
  subtitle TEXT,
  days_count INTEGER,
  assigned_to TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as id,
    'prospect_followup'::TEXT as alert_type,
    p.id as reference_id,
    COALESCE(p.target_client_name, p.name_ar)::TEXT as title,
    'متابعة عميل محتمل'::TEXT as subtitle,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - p.updated_at)::INTEGER as days_count,
    u.full_name::TEXT as assigned_to
  FROM prospects p
  LEFT JOIN user_profiles u ON p.assigned_rep_id = u.id
  WHERE p.company_id = p_company_id 
    -- Assuming interest_level was added at some point
    -- Using lead_status or other indicators if interest_level isn't used correctly
    -- For now, checking the activity span
    AND p.updated_at < CURRENT_DATE - INTERVAL '14 days'
    AND p.stage NOT IN ('converted', 'rejected')
    AND NOT is_alert_dismissed(p_user_id, 'prospect_followup', p.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
