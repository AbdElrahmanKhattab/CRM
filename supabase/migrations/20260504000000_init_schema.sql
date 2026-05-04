-- Phase 1 MVP Schema Initialization

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'supervisor', 'rep');
CREATE TYPE client_category AS ENUM ('beauty', 'optics', 'pharmacies');
CREATE TYPE client_grade AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE visit_type AS ENUM ('routine', 'collection', 'sales', 'delivery');
CREATE TYPE visit_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE prospect_stage AS ENUM ('targeted', 'contacted', 'negotiation', 'converted', 'rejected');

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables

-- Companies (Tenants)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users Profile
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    manager_id UUID REFERENCES user_profiles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regions
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Districts
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    region_id UUID REFERENCES regions(id),
    district_id UUID REFERENCES districts(id),
    assigned_rep_id UUID REFERENCES user_profiles(id),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    category client_category NOT NULL,
    grade client_grade NOT NULL,
    phone_primary VARCHAR(20),
    phone_secondary VARCHAR(20),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    address VARCHAR(500),
    balance_outstanding DECIMAL(12, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prospects
CREATE TABLE prospects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    assigned_rep_id UUID REFERENCES user_profiles(id),
    name_ar VARCHAR(255) NOT NULL,
    category client_category NOT NULL,
    stage prospect_stage DEFAULT 'targeted',
    phone VARCHAR(20),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    notes TEXT,
    converted_client_id UUID REFERENCES clients(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    rep_id UUID REFERENCES user_profiles(id) NOT NULL,
    client_id UUID REFERENCES clients(id),
    prospect_id UUID REFERENCES prospects(id),
    visit_type visit_type NOT NULL,
    status visit_status DEFAULT 'planned',
    scheduled_at TIMESTAMPTZ,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat DECIMAL(10, 8),
    check_in_lng DECIMAL(11, 8),
    notes TEXT,
    sales_amount DECIMAL(12, 2) DEFAULT 0,
    collection_amount DECIMAL(12, 2) DEFAULT 0,
    is_fraud_flagged BOOLEAN DEFAULT FALSE,
    fraud_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT client_or_prospect_required CHECK (client_id IS NOT NULL OR prospect_id IS NOT NULL)
);

-- Visit Photos
CREATE TABLE visit_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    photo_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_photos ENABLE ROW LEVEL SECURITY;

-- Creating functions to get current user's company_id
CREATE OR REPLACE FUNCTION current_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  -- Could be used to define system admin outside of tenant system
  SELECT false;
$$ LANGUAGE sql SECURITY DEFINER;

-- General Policy Template: Users can see and interact only with data matching their company_id
-- We will implement basic isolation first. Further restriction based on assignment/role can be added.

-- Users see their own company (read-only for normal users)
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (id = current_user_company_id() OR is_super_admin());

-- User Profiles: users see profiles in their own company
CREATE POLICY "View company user profiles" ON user_profiles
  FOR SELECT USING (company_id = current_user_company_id() OR is_super_admin());
-- Users can update their own profile (maybe restrict fields later)
CREATE POLICY "Update own user profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Clients: visible based on company_id (Owner/Manager see all, Reps see all or assigned based on requirement)
-- Simplified for MVP: Any user in the company can see clients
CREATE POLICY "View company clients" ON clients
  FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY "Insert company clients" ON clients
  FOR INSERT WITH CHECK (company_id = current_user_company_id());
CREATE POLICY "Update company clients" ON clients
  FOR UPDATE USING (company_id = current_user_company_id());

-- Visits: visible within company
CREATE POLICY "View company visits" ON visits
  FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY "Insert company visits" ON visits
  FOR INSERT WITH CHECK (company_id = current_user_company_id());
CREATE POLICY "Update own visits" ON visits
  FOR UPDATE USING (company_id = current_user_company_id() AND (rep_id = auth.uid() OR (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('owner', 'manager')));

-- Apply similar policies to Regions, Districts, Prospects, Visit Photos
CREATE POLICY "View company regions" ON regions FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY "View company districts" ON districts FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY "View company prospects" ON prospects FOR SELECT USING (company_id = current_user_company_id());
CREATE POLICY "Insert company prospects" ON prospects FOR INSERT WITH CHECK (company_id = current_user_company_id());
CREATE POLICY "Update company prospects" ON prospects FOR UPDATE USING (company_id = current_user_company_id());

CREATE POLICY "View company visit photos" ON visit_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE visits.id = visit_photos.visit_id AND visits.company_id = current_user_company_id())
);
CREATE POLICY "Insert company visit photos" ON visit_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE visits.id = visit_photos.visit_id AND visits.company_id = current_user_company_id())
);

-- Seed Data (Optional, just to mock owner registration)
-- We will handle auth signup via trigger later.
