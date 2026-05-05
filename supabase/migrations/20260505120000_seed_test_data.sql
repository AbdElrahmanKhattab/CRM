DO $$ 
DECLARE
  v_company_id uuid;
  v_region_faragadda uuid;
  v_client1 uuid;
  v_client2 uuid;
  v_rep_id uuid;
BEGIN
  -- Get the first company
  SELECT id INTO v_company_id FROM companies LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Verify or create Faragadda branch
  SELECT id INTO v_region_faragadda FROM regions WHERE company_id = v_company_id AND (name_ar LIKE '%Faragadda%' OR name_en LIKE '%Faragadda%' OR name_ar LIKE '%فراجادا%') LIMIT 1;
  IF v_region_faragadda IS NULL THEN
    INSERT INTO regions (company_id, name_ar, name_en) VALUES (v_company_id, 'فرع فراجادا', 'Faragadda Branch') RETURNING id INTO v_region_faragadda;
  END IF;

  -- Add some clients
  INSERT INTO clients (company_id, name_ar, phone_primary, region_id, is_active, category, grade) 
  VALUES (v_company_id, 'عميل تجريبي - فراجادا 1', '0500000001', v_region_faragadda, true, 'pharmacies', 'A') RETURNING id INTO v_client1;
  
  INSERT INTO clients (company_id, name_ar, phone_primary, region_id, is_active, category, grade) 
  VALUES (v_company_id, 'عميل تجريبي - فراجادا 2', '0500000002', v_region_faragadda, true, 'pharmacies', 'B') RETURNING id INTO v_client2;

  -- Get a rep or owner
  SELECT id INTO v_rep_id FROM user_profiles WHERE company_id = v_company_id AND role = 'rep' LIMIT 1;
  IF v_rep_id IS NULL THEN
    SELECT id INTO v_rep_id FROM user_profiles WHERE company_id = v_company_id LIMIT 1;
  END IF;

  IF v_rep_id IS NULL THEN
    RETURN;
  END IF;

  -- Add Visits to boost Faragadda's numbers significantly
  -- Visit 1: Huge Sales
  INSERT INTO visits (company_id, rep_id, client_id, check_in_time, notes, status, visit_type, sales_amount, collection_amount)
  VALUES (v_company_id, v_rep_id, v_client1, now(), 'صفقة كبرى', 'completed', 'sales', 25000, 15000);

  -- Visit 2: Collections
  INSERT INTO visits (company_id, rep_id, client_id, check_in_time, notes, status, visit_type, sales_amount, collection_amount)
  VALUES (v_company_id, v_rep_id, v_client2, now() - interval '1 day', 'تحصيل دفعة', 'completed', 'collection', 0, 8000);

  -- Visit 3
  INSERT INTO visits (company_id, rep_id, client_id, check_in_time, notes, status, visit_type, sales_amount, collection_amount)
  VALUES (v_company_id, v_rep_id, v_client1, now() - interval '3 days', 'متابعة', 'completed', 'routine', 5000, 5000);

END $$;
