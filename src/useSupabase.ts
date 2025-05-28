import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export const useSupabase = () => {
  const [loading, setLoading] = useState(true);

  // Save workers to database
  const saveWorkers = async (workers: any[]) => {
    const { error } = await supabase
      .from('workers')
      .upsert(workers);
    if (error) console.error('Error saving workers:', error);
  };

  // Load workers from database
  const loadWorkers = async () => {
    const { data, error } = await supabase
      .from('workers')
      .select('*');
    if (error) console.error('Error loading workers:', error);
    return data || [];
  };

  // Save schedule
  const saveSchedule = async (businessId: number, date: string, shifts: any[]) => {
    const { error } = await supabase
      .from('schedules')
      .upsert({ business_id: businessId, date, shifts });
    if (error) console.error('Error saving schedule:', error);
  };

  return {
    saveWorkers,
    loadWorkers,
    saveSchedule,
    loading: false
  };
};