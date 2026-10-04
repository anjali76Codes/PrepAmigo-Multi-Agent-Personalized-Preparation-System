import { useState, useEffect, useCallback } from "react";
import { plansApi, apiPlanToPrep, type ApiPlan } from "../lib/api/plans";
import type { Prep } from "../data/mockData";

export function usePlans() {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [preps, setPreps] = useState<Prep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await plansApi.list();
      const rawPlans = res.data || [];
      setPlans(rawPlans);
      setPreps(rawPlans.map(apiPlanToPrep));
    } catch (err: any) {
      setError(err?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { plans, preps, loading, error, refresh: fetchPlans };
}

export function usePlan(id?: string) {
  const [plan, setPlan] = useState<ApiPlan | null>(null);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await plansApi.get(id);
      if (res.data) {
        setPlan(res.data);
        setPrep(apiPlanToPrep(res.data));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, prep, loading, error, refresh: fetchPlan };
}
