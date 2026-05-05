export type ClientCategory = 'beauty' | 'optics' | 'pharmacies' | 'distribution';
export type ClientGrade = 'A' | 'B' | 'C' | 'D' | 'unclassified';

export interface Region {
  id: string;
  company_id: string;
  name_ar: string;
  name_en?: string;
  created_at?: string;
}

export interface District {
  id: string;
  region_id: string;
  name_ar: string;
  name_en?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  company_id: string;
  legacy_code?: string;
  name_ar: string;
  category: ClientCategory;
  grade: ClientGrade;
  region_id?: string;
  district_id?: string;
  assigned_rep_id?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  contact_person?: string;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;

  // Joined fields for convenience
  region?: Region;
  district?: District;
}

export interface ClientContact {
  id: string;
  client_id: string;
  contact_name: string;
  phone?: string;
  role?: string;
  created_at?: string;
}

export type LeadStatus = 'targeted' | 'potential' | 'contacted' | 'active' | 'field_visit';
export type LeadSource = 'field_visit' | 'social_media' | 'referral' | 'personal_visit' | 'other';
export type InterestLevel = 'interested' | 'needs_follow_up' | 'not_interested' | 'potential';

export interface Prospect {
  id: string;
  company_id: string;
  user_id: string;
  target_client_name: string;
  category?: ClientCategory;
  phone?: string;
  assigned_rep_id?: string;
  contact_person?: string;
  region_id?: string;
  district_name?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  branch_count?: number;
  lead_status: LeadStatus;
  lead_source: LeadSource;
  interest_level?: InterestLevel;
  notes?: string;
  website?: string;
  visit_date?: string;
  converted_client_id?: string;
  created_at?: string;
  updated_at?: string;
  
  region?: Region;
}

export type VisitType = 'routine' | 'collection' | 'sales' | 'delivery';
export type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Visit {
  id: string;
  company_id: string;
  rep_id: string;
  client_id?: string;
  prospect_id?: string;
  visit_type: VisitType;
  status: VisitStatus;
  scheduled_at?: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  notes?: string;
  sales_amount: number;
  collection_amount: number;
  invoice_number?: string;
  next_appointment?: string;
  latitude?: number;
  longitude?: number;
  purpose?: string;
  visit_date?: string;
  is_verified: boolean;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  photo_url: string;
  photo_type?: string;
  created_at?: string;
}
