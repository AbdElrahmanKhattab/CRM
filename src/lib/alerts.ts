import { supabase } from './supabase';

export interface FollowupAlert {
  id: string; // Internal id for React loops if needed 
  alert_type: 'overdue_visit' | 'inactive_client' | 'prospect_followup';
  reference_id: string; 
  title: string;
  subtitle: string;
  days_count: number;
  assigned_to: string;
}

export const fetchFollowupAlerts = async (companyId: string, userId: string, role: string) => {
  try {
    const alerts: FollowupAlert[] = [];
    
    // We fetch based on roles if needed but the RPC already returns data for the company_id. 
    // In actual implementation, we might filter further if role === 'rep' 
    // vs role === 'manager', but for MVP we fetch and return all the company's alerts.
    
    // 1. Overdue Visits
    const { data: overdueData, error: overdueErr } = await supabase.rpc('get_overdue_visits', {
      p_company_id: companyId,
      p_user_id: userId
    });
    if (!overdueErr && overdueData) {
      alerts.push(...overdueData);
    } else if (overdueErr) {
      console.warn('Overdue visits RPC missing or failed:', overdueErr);
    }
    
    // 2. Inactive Clients
    const { data: inactiveData, error: inactiveErr } = await supabase.rpc('get_inactive_clients', {
      p_company_id: companyId,
      p_user_id: userId
    });
    if (!inactiveErr && inactiveData) {
      alerts.push(...inactiveData);
    } else if (inactiveErr) {
      console.warn('Inactive clients RPC missing or failed:', inactiveErr);
    }
    
    // 3. Prospect Followups
    const { data: prospectData, error: prospectErr } = await supabase.rpc('get_prospect_followups', {
      p_company_id: companyId,
      p_user_id: userId
    });
    if (!prospectErr && prospectData) {
      alerts.push(...prospectData);
    } else if (prospectErr) {
      console.warn('Prospect followups RPC missing or failed:', prospectErr);
    }
    
    // Fallback: If RPCs don't exist yet, we don't throw, we just return empty
    return alerts.sort((a, b) => b.days_count - a.days_count);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
};

export const dismissAlert = async (companyId: string, userId: string, alertType: string, referenceId: string) => {
  try {
    const { error } = await supabase
      .from('dismissed_alerts')
      .insert({
        company_id: companyId,
        user_id: userId,
        alert_type: alertType,
        reference_id: referenceId
      });

    if (error) {
      console.error('Error dismissing alert:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error executing dismiss:', error);
    throw error;
  }
};
